"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type Baseline,
	CameraAccumulator,
	type CameraAnalysis,
	type CameraFrame,
	type CameraSettings,
	defaultCameraSettings,
	type Features,
	features,
	makeBaseline,
} from "@/lib/camera-analysis";

type Status = "off" | "loading" | "preview" | "calibrating" | "ready" | "error";
type Sampling = { enabled: boolean; answer: number };
type Capture = {
	worker: Worker | null;
	stream: MediaStream | null;
	video: HTMLVideoElement | null;
	timer: ReturnType<typeof setInterval> | null;
	deadline: ReturnType<typeof setTimeout> | null;
	pending: { time: number; sampling: Sampling; generation: number } | null;
	busy: boolean;
};
export function useCameraAnalysis() {
	const [status, setStatus] = useState<Status>("off");
	const [error, setError] = useState("");
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [progress, setProgress] = useState(0);
	const [quality, setQuality] = useState(
		"카메라를 켜면 얼굴과 조명을 확인해요.",
	);
	const [settings, setSettings] = useState<CameraSettings>(
		defaultCameraSettings,
	);
	const [analysis, setAnalysis] = useState<CameraAnalysis | null>(null);
	const [calibrated, setCalibrated] = useState(false);
	const capture = useRef<Capture | null>(null);
	const baseline = useRef<Baseline | null>(null);
	const calibration = useRef<{ start: number; samples: Features[] } | null>(
		null,
	);
	const collector = useRef<CameraAccumulator | null>(null);
	const origin = useRef(0);
	const sampling = useRef<Sampling>({ enabled: false, answer: 1 });
	const generation = useRef(0);
	const saved = useRef<CameraAnalysis | null>(null);
	const lastPublish = useRef(0);
	const release = useCallback(() => {
		const c = capture.current;
		capture.current = null;
		calibration.current = null;
		generation.current++;
		if (!c) return;
		if (c.timer) clearInterval(c.timer);
		if (c.deadline) clearTimeout(c.deadline);
		c.worker?.terminate();
		c.stream?.getTracks().forEach((t) => {
			t.stop();
		});
		if (c.video) {
			c.video.pause();
			c.video.srcObject = null;
		}
	}, []);
	const stop = useCallback(() => {
		collector.current?.boundary();
		const result = collector.current?.snapshot() ?? saved.current;
		saved.current = result;
		setAnalysis(result);
		release();
		setStream(null);
		setStatus("off");
		setCalibrated(false);
		return result;
	}, [release]);
	const reset = useCallback(() => {
		release();
		collector.current = null;
		saved.current = null;
		baseline.current = null;
		sampling.current = { enabled: false, answer: 1 };
		setStream(null);
		setAnalysis(null);
		setStatus("off");
		setError("");
		setCalibrated(false);
		setProgress(0);
	}, [release]);
	useEffect(() => release, [release]);
	const start = useCallback(async () => {
		if (capture.current) return;
		setError("");
		setStatus("loading");
		setCalibrated(false);
		baseline.current = null;
		const c: Capture = {
			worker: null,
			stream: null,
			video: null,
			timer: null,
			deadline: null,
			pending: null,
			busy: false,
		};
		capture.current = c;
		const live = () => capture.current === c;
		const fail = (message: string) => {
			if (!live()) return;
			release();
			collector.current?.boundary();
			setStream(null);
			setStatus("error");
			setCalibrated(false);
			setError(message);
		};
		c.deadline = setTimeout(
			() =>
				fail(
					"카메라 권한 또는 분석 준비 시간이 초과됐어요. 권한을 확인한 뒤 다시 시도하거나 카메라 없이 진행해 주세요.",
				),
			45000,
		);
		try {
			if (
				!navigator.mediaDevices?.getUserMedia ||
				!window.Worker ||
				!window.createImageBitmap ||
				!window.OffscreenCanvas
			)
				throw new Error("unsupported");
			const media = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 640 },
					height: { ideal: 480 },
					facingMode: "user",
					frameRate: { ideal: 15, max: 30 },
				},
				audio: false,
			});
			if (!live()) {
				media.getTracks().forEach((t) => {
					t.stop();
				});
				return;
			}
			c.stream = media;
			setStream(media);
			media.getVideoTracks().forEach((t) => {
				t.addEventListener(
					"ended",
					() =>
						fail(
							"카메라 연결이 끊겼어요. 다시 연결하거나 카메라 없이 연습을 계속하세요.",
						),
					{ once: true },
				);
			});
			const video = document.createElement("video");
			video.muted = true;
			video.playsInline = true;
			video.srcObject = media;
			c.video = video;
			await video.play();
			if (!live()) return;
			const worker = new Worker(
				new URL("../workers/camera.worker.ts", import.meta.url),
			);
			c.worker = worker;
			worker.onerror = () =>
				fail(
					"카메라 분석을 실행하지 못했어요. 최신 Chrome에서 다시 시도하거나 카메라 없이 진행해 주세요.",
				);
			worker.onmessage = (
				event: MessageEvent<{
					type: string;
					frame?: CameraFrame;
					time?: number;
				}>,
			) => {
				if (!live()) return;
				if (event.data.type === "error") {
					fail(
						"분석 모델을 불러오거나 실행하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.",
					);
					return;
				}
				if (event.data.type === "ready") {
					if (c.deadline) clearTimeout(c.deadline);
					c.deadline = null;
					setStatus("preview");
					c.timer = setInterval(() => {
						if (!live() || document.hidden || c.busy || video.readyState < 2)
							return;
						c.busy = true;
						const timestamp = performance.now();
						c.pending = {
							time: timestamp,
							sampling: { ...sampling.current },
							generation: generation.current,
						};
						c.deadline = setTimeout(
							() =>
								fail(
									"카메라 분석 응답이 멈췄어요. 다시 연결해 주세요. 면접은 계속할 수 있어요.",
								),
							10000,
						);
						void createImageBitmap(video)
							.then((bitmap) => {
								if (!live()) {
									bitmap.close();
									return;
								}
								worker.postMessage({ type: "frame", bitmap, time: timestamp }, [
									bitmap,
								]);
							})
							.catch(() =>
								fail(
									"카메라 영상을 읽지 못했어요. 다른 앱에서 카메라를 사용 중인지 확인해 주세요.",
								),
							);
					}, 150);
					return;
				}
				const pending = c.pending;
				c.pending = null;
				c.busy = false;
				if (c.deadline) clearTimeout(c.deadline);
				c.deadline = null;
				const frame = event.data.frame;
				if (!frame || !pending || document.hidden) return;
				const value = features(frame);
				setQuality(
					frame.faces.length > 1
						? "한 사람만 화면에 들어오도록 조정해 주세요."
						: value
							? "얼굴 확인됨"
							: "얼굴 전체가 보이도록 위치와 조명을 조정해 주세요.",
				);
				const cal = calibration.current;
				if (cal) {
					if (value) cal.samples.push(value);
					const elapsed = (pending.time - cal.start) / 1000;
					setProgress(Math.min(100, Math.round((elapsed / 10) * 100)));
					if (elapsed >= 10) {
						calibration.current = null;
						const result = makeBaseline(cal.samples);
						if (result && cal.samples.length >= 40) {
							baseline.current = result;
							collector.current?.updateBaseline(result);
							setCalibrated(true);
							setStatus("ready");
							setError("");
						} else {
							setStatus("preview");
							setError(
								"안정적인 기준 자세를 충분히 측정하지 못했어요. 조명과 위치를 확인하고 다시 보정해 주세요.",
							);
						}
					}
				} else if (
					collector.current &&
					baseline.current &&
					pending.generation === generation.current
				) {
					if (pending.sampling.enabled)
						collector.current.sample(
							frame,
							(pending.time - origin.current) / 1000,
							pending.sampling.answer,
						);
					else collector.current.boundary();
					if (pending.time - lastPublish.current > 1000) {
						lastPublish.current = pending.time;
						const snapshot = collector.current.snapshot();
						saved.current = snapshot;
						setAnalysis(snapshot);
					}
				}
			};
			worker.postMessage({
				type: "init",
				base: new URL("/camera-assets", window.location.origin).href,
			});
		} catch (cause) {
			const name = cause instanceof Error ? cause.name : "";
			fail(
				name === "NotAllowedError"
					? "카메라 권한이 거부됐어요. 주소창의 사이트 설정에서 허용하거나 카메라 없이 진행해 주세요."
					: name === "NotFoundError"
						? "카메라를 찾지 못했어요. 장치를 연결하거나 카메라 없이 진행해 주세요."
						: "이 환경에서는 카메라 분석을 시작하지 못했어요. HTTPS 또는 localhost의 최신 Chrome에서 열어 주세요.",
			);
		}
	}, [release]);
	const calibrate = useCallback(() => {
		collector.current?.boundary();
		generation.current++;
		baseline.current = null;
		setCalibrated(false);
		setError("");
		setProgress(0);
		setStatus("calibrating");
		calibration.current = { start: performance.now(), samples: [] };
	}, []);
	const begin = useCallback(() => {
		sampling.current = { enabled: false, answer: 1 };
		generation.current++;
		origin.current = performance.now();
		collector.current =
			baseline.current && capture.current
				? new CameraAccumulator(settings, baseline.current)
				: null;
		saved.current = null;
		setAnalysis(null);
	}, [settings]);
	const setSampling = useCallback((next: Sampling) => {
		if (
			next.enabled !== sampling.current.enabled ||
			next.answer !== sampling.current.answer
		) {
			collector.current?.boundary();
			generation.current++;
		}
		sampling.current = next;
	}, []);
	useEffect(() => {
		const hide = () => {
			if (document.hidden) {
				collector.current?.boundary();
				generation.current++;
			}
		};
		document.addEventListener("visibilitychange", hide);
		return () => document.removeEventListener("visibilitychange", hide);
	}, []);
	return {
		status,
		error,
		stream,
		progress,
		quality,
		settings,
		setSettings,
		analysis,
		calibrated,
		start,
		stop,
		reset,
		calibrate,
		begin,
		setSampling,
	};
}
export type CameraController = ReturnType<typeof useCameraAnalysis>;
