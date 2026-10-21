"use client";
import { useEffect, useRef } from "react";
import type { CameraController } from "@/hooks/use-camera-analysis";
import { cameraLabels } from "@/lib/camera-analysis";
import { Button } from "./ui";
import "./camera.css";

function CameraPreview({ stream }: { stream: MediaStream | null }) {
	const video = useRef<HTMLVideoElement>(null);
	useEffect(() => {
		const element = video.current;
		if (!element) return;
		element.srcObject = stream;
		if (stream) void element.play().catch(() => {});
		return () => {
			element.srcObject = null;
		};
	}, [stream]);
	return (
		<video
			ref={video}
			className="camera-preview"
			muted
			playsInline
			autoPlay
			aria-label="나의 카메라 미리보기 · 좌우 반전"
		/>
	);
}
export function CameraPreparation({
	camera,
	inSession = false,
}: {
	camera: CameraController;
	inSession?: boolean;
}) {
	const loading = camera.status === "loading";
	const active = !!camera.stream;
	return (
		<section className="camera-panel" aria-label="카메라 준비">
			<h3>
				시선·자세 코칭 <span className="tag">선택</span>
			</h3>
			<p>
				영상은 이 기기에서 분석하고 저장·전송하지 않아요. 부정행위·성격·채용
				적합성을 판단하지 않습니다.
			</p>
			<p className="context-hint">
				눈 방향은 실험적 추정이에요. 안경·조명·카메라 위치에 따라 측정이 어려울
				수 있어요. 카메라 없이도 모든 면접 기능을 사용할 수 있습니다.
			</p>
			{active && <CameraPreview stream={camera.stream} />}
			{active && <p role="status">{camera.quality}</p>}
			<div className="camera-actions">
				{!active && !loading && (
					<Button variant="secondary" onClick={() => void camera.start()}>
						카메라 켜기
					</Button>
				)}
				{loading && <p role="status">카메라 권한·분석 모델 준비 중…</p>}
				{(active || loading) && (
					<Button
						variant="ghost"
						onClick={() => (inSession ? camera.stop() : camera.reset())}
					>
						카메라 없이 진행
					</Button>
				)}
				{active && !loading && camera.status !== "calibrating" && (
					<Button variant="secondary" onClick={camera.calibrate}>
						{camera.calibrated ? "다시 보정" : "기준 자세 보정 · 10초"}
					</Button>
				)}
			</div>
			{camera.status === "calibrating" && (
				<div role="status">
					<p>
						{camera.progress < 50
							? "편안한 자세로 카메라를 바라봐 주세요."
							: "고개를 크게 움직이지 않고 이 안내 문장을 바라봐 주세요."}
					</p>
					<progress
						value={camera.progress}
						max={100}
						aria-label="기준 자세 보정 진행률"
					/>
				</div>
			)}
			{camera.calibrated && (
				<p className="camera-ready" role="status">
					{inSession
						? "보정 완료 · 답변 측정을 이어갈 수 있어요."
						: "보정 완료 · 입장 후 답변 구간을 측정해요."}
				</p>
			)}
			{camera.error && (
				<p className="error-box" role="alert">
					{camera.error}
				</p>
			)}
			{!inSession && (
				<div className="camera-settings">
					<label>
						자료 참조 설정
						<select
							value={camera.settings.reference}
							onChange={(e) =>
								camera.setSettings({
									...camera.settings,
									reference: e.target.value === "closed" ? "closed" : "allowed",
								})
							}
						>
							<option value="allowed">자료 참조 허용</option>
							<option value="closed">자료 없이 연습</option>
						</select>
					</label>
					<label>
						피드백 시점
						<select
							value={camera.settings.feedback}
							onChange={(e) =>
								camera.setSettings({
									...camera.settings,
									feedback: e.target.value === "live" ? "live" : "review",
								})
							}
						>
							<option value="review">실전 모드 · 종료 후 확인</option>
							<option value="live">코칭 모드 · 연습 중 안내</option>
						</select>
					</label>
					<label className="camera-consent">
						<input
							type="checkbox"
							checked={camera.settings.shareSummary}
							onChange={(e) =>
								camera.setSettings({
									...camera.settings,
									shareSummary: e.target.checked,
								})
							}
						/>
						측정 요약을 OpenAI 리포트에도 사용하기
					</label>
					<small>
						선택하지 않으면 카메라 결과는 이 브라우저의 리포트에만 표시해요.
						데모에서는 선택해도 OpenAI에 보내지 않아요.
					</small>
				</div>
			)}
		</section>
	);
}
export function CameraSessionPanel({
	camera,
	enabled,
	connected,
	onToggle,
	disabled,
}: {
	camera: CameraController;
	enabled: boolean;
	connected: boolean;
	onToggle: () => void;
	disabled: boolean;
}) {
	const event = camera.analysis?.events.at(-1);
	if (!camera.stream || !camera.calibrated)
		return (
			<section className="form-panel">
				<CameraPreparation camera={camera} inSession />
			</section>
		);
	return (
		<section className="form-panel camera-panel" aria-label="시선·자세 코칭">
			<h2>시선·자세 코칭</h2>
			{camera.stream ? (
				<CameraPreview stream={camera.stream} />
			) : (
				<p>카메라가 꺼져 있어요. 면접은 계속할 수 있습니다.</p>
			)}
			<p role="status">
				{camera.stream
					? enabled
						? "답변 구간 측정 중"
						: "측정 대기 · 질문·휴식 시간은 제외해요"
					: "촬영 종료"}
			</p>
			{camera.stream && <p className="context-hint">{camera.quality}</p>}
			{!connected && camera.stream && (
				<>
					<p className="context-hint">
						글을 입력하거나 소리 내어 답하는 동안 직접 측정을 켜 주세요. 글 입력
						중의 움직임도 포함됩니다.
					</p>
					<Button variant="secondary" disabled={disabled} onClick={onToggle}>
						{enabled ? "답변 측정 마치기" : "답변 측정 시작"}
					</Button>
				</>
			)}
			{camera.stream && (
				<Button variant="ghost" onClick={() => camera.stop()}>
					카메라 끄기
				</Button>
			)}
			{camera.error && (
				<p className="error-box" role="alert">
					{camera.error}
				</p>
			)}
			{camera.settings.feedback === "live" && enabled && event && (
				<p className="camera-coaching" role="status">
					최근 확인 구간: {cameraLabels[event.kind]}. 종료 후 타임라인에서
					확인해 주세요.
				</p>
			)}
			<p className="context-hint">
				얼굴 방향·눈 좌표의 추정값입니다. 글 읽기나 부정행위를 판정하지 않아요.
				원본 영상은 저장하지 않습니다.
			</p>
		</section>
	);
}
