"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type VoiceAnalysis, VoiceMeter } from "@/lib/voice-analysis";

type Capture = {
	readonly stream: MediaStream;
	readonly owned: boolean;
	readonly context: AudioContext;
	readonly timer: ReturnType<typeof setInterval>;
	readonly meter: VoiceMeter;
	readonly track: MediaStreamTrack | undefined;
	readonly ended: () => void;
};
export function useVoiceAnalysis(shouldSample: () => boolean) {
	const current = useRef<Capture | null>(null);
	const starting = useRef(false);
	const generation = useRef(0);
	const sampling = useRef(shouldSample);
	sampling.current = shouldSample;
	const [active, setActive] = useState(false);
	const [connecting, setConnecting] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const [analysis, setAnalysis] = useState<VoiceAnalysis | undefined>();
	const [error, setError] = useState("");
	const stop = useCallback(() => {
		generation.current++;
		starting.current = false;
		setConnecting(false);
		const capture = current.current;
		current.current = null;
		if (!capture) return undefined;
		clearInterval(capture.timer);
		capture.track?.removeEventListener("ended", capture.ended);
		if (capture.owned)
			capture.stream.getTracks().forEach((track) => {
				track.stop();
			});
		void capture.context.close();
		const result = capture.meter.snapshot();
		setAnalysis(result);
		setActive(false);
		setSeconds(result.analysedSeconds);
		return result;
	}, []);
	const stopRef = useRef(stop);
	stopRef.current = stop;
	const start = useCallback(async (stream?: MediaStream) => {
		if (current.current || starting.current) return;
		const id = ++generation.current;
		starting.current = true;
		setConnecting(true);
		setError("");
		let input: MediaStream | undefined = stream;
		let context: AudioContext | undefined;
		try {
			input =
				stream ??
				(await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: false,
					},
				}));
			if (generation.current !== id) {
				if (!stream)
					input.getTracks().forEach((track) => {
						track.stop();
					});
				return;
			}
			context = new AudioContext();
			await context.resume();
			if (generation.current !== id) {
				void context.close();
				if (!stream)
					input.getTracks().forEach((track) => {
						track.stop();
					});
				return;
			}
			const analyser = context.createAnalyser();
			analyser.fftSize = 2048;
			context.createMediaStreamSource(input).connect(analyser);
			const samples = new Float32Array(analyser.fftSize);
			const meter = new VoiceMeter();
			const sampleRate = context.sampleRate;
			let last = performance.now();
			let shown = 0;
			const ended = () => {
				stopRef.current();
			};
			const track = input.getAudioTracks()[0];
			track?.addEventListener("ended", ended);
			const timer = setInterval(() => {
				const now = performance.now();
				const delta = (now - last) / 1000;
				last = now;
				if (sampling.current()) {
					analyser.getFloatTimeDomainData(samples);
					meter.add(samples, sampleRate, delta);
				}
				shown += delta;
				if (shown >= 1) {
					shown = 0;
					const snapshot = meter.snapshot();
					setSeconds(snapshot.analysedSeconds);
					if (snapshot.analysedSeconds >= 1800) stopRef.current();
				}
			}, 100);
			current.current = {
				stream: input,
				owned: !stream,
				context,
				timer,
				meter,
				track,
				ended,
			};
			setAnalysis(undefined);
			setSeconds(0);
			setActive(true);
		} catch (cause) {
			if (context) void context.close();
			if (input && !stream)
				input.getTracks().forEach((track) => {
					track.stop();
				});
			if (generation.current === id)
				setError(
					cause instanceof DOMException && cause.name === "NotAllowedError"
						? "마이크 권한을 허용한 뒤 다시 시작해 주세요."
						: "마이크 분석을 시작하지 못했습니다. 마이크와 브라우저 설정을 확인해 주세요.",
				);
		} finally {
			if (generation.current === id) {
				starting.current = false;
				setConnecting(false);
			}
		}
	}, []);
	const addTranscript = useCallback((text: string) => {
		current.current?.meter.addTranscript(text);
	}, []);
	useEffect(
		() => () => {
			generation.current++;
			const capture = current.current;
			if (!capture) return;
			clearInterval(capture.timer);
			capture.track?.removeEventListener("ended", capture.ended);
			if (capture.owned)
				capture.stream.getTracks().forEach((track) => {
					track.stop();
				});
			void capture.context.close();
		},
		[],
	);
	return {
		start,
		stop,
		active,
		connecting,
		seconds,
		analysis,
		error,
		addTranscript,
	};
}
