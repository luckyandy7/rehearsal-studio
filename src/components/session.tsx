"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraController } from "@/hooks/use-camera-analysis";
import { useRealtime } from "@/hooks/use-realtime";
import { useVoiceAnalysis } from "@/hooks/use-voice-analysis";
import { api, errorMessage } from "@/lib/api";
import { demoQuestion } from "@/lib/demo-question";
import { questionSchema } from "@/lib/interview-context";
import { hints, mergeCamera } from "@/lib/learning";
import {
	type Message,
	type PracticeRecord,
	reportSchema,
	type SessionConfig,
	type SessionDraft,
} from "@/lib/types";
import { CameraSessionPanel } from "./camera-panel";
import { EmployerMaterials, QuestionSources } from "./employer-context";
import { Button, Waveform } from "./ui";
import { VoiceFeedback } from "./voice-feedback";
import "./session.css";

const labels = {
	idle: "연결 전",
	connecting: "음성 연결 중",
	listening: "답변을 듣고 있어요",
	speaking: "AI 질문 중",
	paused: "일시 정지",
	error: "연결 오류",
};
export function Session({
	config,
	camera,
	onComplete,
	initialDraft,
	onDraft,
}: {
	config: SessionConfig;
	camera: CameraController;
	onComplete: (record: PracticeRecord) => void;
	initialDraft?: SessionDraft | undefined;
	onDraft: (draft: SessionDraft) => void;
}) {
	const [cameraManual, setCameraManual] = useState(false);
	const [userSpeaking, setUserSpeaking] = useState(false);
	const [messages, setMessages] = useState<Message[]>(
		initialDraft?.messages ??
			(config.retry
				? [{ role: "assistant", content: config.retry.question }]
				: []),
	);
	const [answer, setAnswer] = useState(initialDraft?.answer ?? "");
	const [hintsUsed, setHintsUsed] = useState(initialDraft?.hintsUsed ?? 0);
	const hintRef = useRef(hintsUsed);
	hintRef.current = hintsUsed;
	const [busy, setBusy] = useState(false);
	const [finishing, setFinishing] = useState(false);
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		heading.current?.focus();
	}, []);
	const [error, setError] = useState("");
	const [started, setStarted] = useState(!!initialDraft || !!config.retry);
	const [paused, setPaused] = useState(!!initialDraft);
	const [seconds, setSeconds] = useState(initialDraft?.seconds ?? 0);
	const secondsRef = useRef(seconds);
	secondsRef.current = seconds;
	const draftId = useRef(initialDraft?.id ?? crypto.randomUUID());
	const draftCallback = useRef(onDraft);
	draftCallback.current = onDraft;
	const completed = useRef(false);
	const controller = useRef<AbortController | null>(null);
	const end = useRef<HTMLDivElement>(null);
	const sampleEnabled = useRef(true);
	const coach = useVoiceAnalysis(() => sampleEnabled.current);
	const onMessage = useCallback(
		(message: Message) => {
			if (message.role === "user") coach.addTranscript(message.content);
			const enriched: Message = {
				...message,
				atSeconds: secondsRef.current,
				...(message.role === "user"
					? { hintsUsed: hintRef.current, voiceAnalysis: coach.takeAnswer() }
					: {}),
			};
			setMessages((previous) => [...previous, enriched]);
			if (message.role === "user") setHintsUsed(0);
		},
		[coach.addTranscript, coach.takeAnswer],
	);
	const voice = useRealtime({
		config,
		messages,
		onMessage,
		onSpeechChange: setUserSpeaking,
		onStreamEnd: () => {
			coach.stop();
		},
		onStream: (stream) => {
			void coach.start(stream);
		},
	});
	const connected = !["idle", "error"].includes(voice.status);
	const cameraEnabled =
		!!camera.stream &&
		camera.calibrated &&
		started &&
		!paused &&
		!busy &&
		(connected ? voice.status === "listening" && userSpeaking : cameraManual);
	const answerNumber = messages.filter((m) => m.role === "user").length + 1;
	useEffect(() => {
		camera.setSampling({ enabled: cameraEnabled, answer: answerNumber });
	}, [camera.setSampling, cameraEnabled, answerNumber]);
	useEffect(
		() => () => {
			camera.setSampling({ enabled: false, answer: 1 });
		},
		[camera.setSampling],
	);
	sampleEnabled.current =
		!paused && (connected ? voice.status === "listening" : !busy);
	const snapshot: SessionDraft = {
		version: 1,
		id: draftId.current,
		updatedAt: new Date().toISOString(),
		config,
		messages,
		answer,
		seconds,
		hintsUsed,
		voiceAnalysis: coach.analysis ?? initialDraft?.voiceAnalysis,
		cameraAnalysis: mergeCamera(
			initialDraft?.cameraAnalysis,
			camera.analysis,
			initialDraft?.seconds ?? 0,
			camera.settings,
		),
	};
	const snapshotRef = useRef(snapshot);
	snapshotRef.current = snapshot;
	useEffect(() => {
		const save = () => {
			if (!completed.current) draftCallback.current(snapshotRef.current);
		};
		const timer = setTimeout(save, 200);
		window.addEventListener("pagehide", save);
		return () => {
			clearTimeout(timer);
			window.removeEventListener("pagehide", save);
		};
	}, [messages, answer, seconds, hintsUsed, coach.analysis, camera.analysis]);
	useEffect(
		() => () => {
			if (!completed.current) draftCallback.current(snapshotRef.current);
		},
		[],
	);
	useEffect(() => {
		if (messages.length >= 76 && connected) {
			voice.disconnect();
			setPaused(true);
			setError("대화가 충분히 쌓였어요. 연습을 마치고 리포트를 확인해 주세요.");
		}
	}, [messages.length, connected, voice.disconnect]);
	useEffect(() => () => controller.current?.abort(), []);
	useEffect(() => {
		if (messages.length && end.current?.parentElement) {
			const log = end.current.parentElement;
			log.scrollTop = log.scrollHeight;
		}
	}, [messages]);
	useEffect(() => {
		if (!started || paused || busy) return;
		const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
		return () => clearInterval(timer);
	}, [started, paused, busy]);
	const turn = async (action: "start" | "followup" | "interrupt") => {
		if (busy) return;
		if (config.retry) {
			await finish();
			return;
		}
		const next: Message[] = answer.trim()
			? [
					...messages,
					{
						role: "user",
						content: answer.trim(),
						hintsUsed,
						atSeconds: seconds,
						voiceAnalysis: coach.takeAnswer(),
					},
				]
			: messages;
		if (next.length >= 78) {
			setError("대화가 충분히 쌓였어요. 연습을 마치고 리포트를 확인해 주세요.");
			return;
		}
		setCameraManual(false);
		setMessages(next);
		setAnswer("");
		setHintsUsed(0);
		setBusy(true);
		setError("");
		controller.current = new AbortController();
		try {
			const question =
				config.provider === "demo"
					? demoQuestion(
							config,
							next.filter((message) => message.role === "user").length,
						)
					: questionSchema.parse(
							await api
								.post("/api/turn", {
									json: { ...config, messages: next, action },
									signal: controller.current.signal,
								})
								.json<unknown>(),
						);
			setMessages([
				...next,
				{
					role: "assistant",
					content: question.text,
					sources: question.sources,
				},
			]);
			setAnswer("");
			setStarted(true);
		} catch (cause) {
			setError(await errorMessage(cause));
		} finally {
			setBusy(false);
		}
	};
	const hasAnswer =
		messages.some((message) => message.role === "user") ||
		Boolean(answer.trim());
	const finish = async () => {
		if (busy || !hasAnswer) return;
		setFinishing(true);
		const cameraAnalysis = mergeCamera(
			initialDraft?.cameraAnalysis,
			camera.stop(),
			initialDraft?.seconds ?? 0,
			camera.settings,
		);
		const voiceAnalysis =
			coach.stop() ?? coach.analysis ?? initialDraft?.voiceAnalysis;
		voice.disconnect();
		setPaused(true);
		setBusy(true);
		setError("");
		const next: Message[] = answer.trim()
			? [
					...messages,
					{
						role: "user",
						content: answer.trim(),
						hintsUsed,
						atSeconds: seconds,
						voiceAnalysis: coach.takeAnswer(),
					},
				]
			: messages;
		setMessages(next);
		setAnswer("");
		setHintsUsed(0);
		controller.current = new AbortController();
		try {
			const report =
				config.provider === "demo"
					? {
							summary: `데모에서 답변 ${next.filter((m) => m.role === "user").length}개를 기록했습니다. 실제 AI 분석은 수행하지 않았습니다.`,
							strengths: ["연습을 마치고 답변 기록을 남겼습니다."],
							improvements: ["이 데모는 답변의 품질을 평가하지 않습니다."],
							exercises: [
								"주장, 직접 한 행동, 확인 가능한 결과 순서로 다시 답해 보세요.",
							],
							evidence: next
								.filter((m) => m.role === "user")
								.slice(0, 2)
								.map((m) => ({
									quote: m.content,
									feedback:
										"직접 작성한 답변입니다. 구체적인 행동과 결과가 포함되었는지 스스로 확인해 보세요.",
								})),
						}
					: reportSchema.parse(
							await api
								.post("/api/report", {
									json: {
										...config,
										messages: next,
										voiceAnalysis,
										...(cameraAnalysis?.settings.shareSummary
											? { cameraAnalysis }
											: {}),
									},
									signal: controller.current.signal,
								})
								.json<unknown>(),
						);
			completed.current = true;
			onComplete({
				id: crypto.randomUUID(),
				createdAt: new Date().toISOString(),
				config,
				messages: next,
				report,
				elapsedSeconds: seconds,
				...(voiceAnalysis ? { voiceAnalysis } : {}),
				...(cameraAnalysis ? { cameraAnalysis } : {}),
			});
		} catch (cause) {
			setError(await errorMessage(cause));
		} finally {
			setBusy(false);
			setFinishing(false);
		}
	};
	return (
		<div className="screen-stack">
			<header className="session-heading">
				<div>
					<span className="eyebrow">
						{config.mode === "interview"
							? "INTERVIEW ROOM"
							: "PRESENTATION ROOM"}
					</span>
					<h1 ref={heading} tabIndex={-1}>
						{config.role}
					</h1>
					<p>
						{config.mode === "interview"
							? "경험을 이야기하고, 꼬리 질문에 답해 보세요."
							: "발표를 이어가세요. AI 심사위원이 근거를 질문합니다."}
					</p>
				</div>
				<span className="session-clock">
					{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}{" "}
					<small>/ {config.durationMinutes}분</small>
				</span>
			</header>
			<section className="session-finish-bar" aria-label="연습 종료와 리포트">
				<div>
					<strong>
						{finishing
							? "답변을 정리해 리포트를 만들고 있어요"
							: "연습의 마지막 단계, 나의 리포트"}
					</strong>
					<p id="report-action-hint" role="status">
						{finishing
							? "완료되면 리포트가 바로 열려요. 잠시 기다려 주세요."
							: !hasAnswer
								? "답변을 한 번 이상 남기면 리포트를 만들 수 있어요."
								: connected
									? "마지막 답변 자막을 확인한 뒤 눌러 주세요. 음성 연결도 종료됩니다."
									: "준비됐다면 연습을 마치고 피드백을 확인하세요."}
					</p>
				</div>
				<Button
					busy={finishing}
					disabled={busy || !hasAnswer}
					aria-describedby="report-action-hint"
					onClick={() => void finish()}
				>
					{finishing ? "리포트 생성 중" : "연습 종료 · 리포트 생성"}
				</Button>
				{(error || voice.error) && (
					<p className="error-box session-finish-error" role="alert">
						{error || voice.error} 대화 기록은 유지됩니다. 다시 시도해 주세요.
					</p>
				)}
				{error && !busy && messages.at(-1)?.role === "user" && !paused && (
					<Button
						variant="secondary"
						onClick={() =>
							void turn(
								config.mode === "presentation" ? "interrupt" : "followup",
							)
						}
					>
						질문 생성 다시 시도
					</Button>
				)}
			</section>
			{config.provider === "demo" && (
				<p className="demo-banner">
					데모 체험 · 준비된 질문 틀에 입력 자료를 넣습니다. 실제 AI·음성 연결은
					사용하지 않습니다.
				</p>
			)}
			{initialDraft && (
				<p className="demo-banner">
					임시 기록을 복원했어요. 계속하기를 누르거나 음성을 다시 연결하세요.
					완료되지 않은 음성 자막은 복원되지 않습니다.
				</p>
			)}
			{config.retry && (
				<section className="form-panel">
					<h2>
						{config.retry.previousAnswer
							? "같은 질문, 다시 답해보기"
							: "아직 설명하지 못한 역량 연습"}
					</h2>
					<p>{config.retry.question}</p>
					<p>확인할 기준: {config.retry.criteria.join(" · ")}</p>
					<p>
						답변을 마치면 리포트에서{" "}
						{config.retry.previousAnswer
							? "이전 답변과 비교합니다."
							: "근거를 확인합니다."}
					</p>
				</section>
			)}
			<div className="practice-grid">
				<section className="conversation-panel">
					<div className="voice-stage">
						<span className="tag">
							{connected
								? labels[voice.status]
								: paused
									? "일시 정지"
									: busy
										? "AI 응답 준비 중"
										: "텍스트 연습"}
						</span>
						<Waveform active={connected && !voice.muted} level={voice.level} />
						<h2>
							{connected
								? "편하게 말해 주세요"
								: "한 번의 답변이, 다음의 자신감으로."}
						</h2>
						<p>
							{connected
								? "AI가 생성한 음성입니다. 답변 자막이 나온 뒤 연습을 마쳐주세요."
								: "글로 답하거나 실시간 음성으로 연습할 수 있어요."}
						</p>
						<div className="session-controls">
							{config.provider === "openai" && (
								<Button
									variant="secondary"
									disabled={busy}
									onClick={() => {
										if (connected) {
											coach.stop();
											voice.disconnect();
										} else {
											coach.stop();
											setStarted(true);
											setPaused(false);
											const next: Message[] = answer.trim()
												? [
														...messages,
														{
															role: "user",
															content: answer.trim(),
															hintsUsed,
															atSeconds: seconds,
															voiceAnalysis: coach.takeAnswer(),
														},
													]
												: messages;
											setMessages(next);
											setAnswer("");
											setHintsUsed(0);
											void voice.connect(next);
										}
									}}
								>
									{connected ? "음성 연결 종료" : "실시간 음성 연결"}
								</Button>
							)}
							{started && (
								<Button
									variant="secondary"
									disabled={busy}
									onClick={() => {
										if (connected) voice.toggleMute();
										setPaused(!paused);
									}}
								>
									{paused ? "계속하기" : "일시 정지"}
								</Button>
							)}
							{connected && (
								<Button variant="secondary" onClick={voice.interrupt}>
									AI 말 멈추기
								</Button>
							)}
							{voice.status === "error" && (
								<Button
									variant="secondary"
									onClick={() => {
										voice.disconnect();
										setPaused(false);
									}}
								>
									텍스트로 계속하기
								</Button>
							)}
						</div>
					</div>
					<div
						className="conversation-log"
						role="log"
						aria-label="연습 대화"
						aria-live="polite"
					>
						{messages.length === 0 && (
							<div className="conversation-empty">
								<h3>준비되셨나요?</h3>
								<p>음성 연결 또는 아래 첫 질문 버튼으로 시작하세요.</p>
							</div>
						)}
						{messages.map((message, index) => (
							<article
								className={`chat-message ${message.role}`}
								key={`${index}-${message.role}`}
							>
								<strong>
									{message.role === "user"
										? "나의 답변"
										: config.mode === "interview"
											? "AI 면접관"
											: "AI 심사위원"}
								</strong>
								<p>{message.content}</p>
								<QuestionSources sources={message.sources} />
								{!!message.hintsUsed && (
									<small>힌트 {message.hintsUsed}단계 사용</small>
								)}
								{message.trigger && (
									<p className="context-hint">
										반박 근거: “{message.trigger.quote}” ·{" "}
										{message.trigger.reason}
									</p>
								)}
							</article>
						))}
						<div ref={end} />
					</div>
					{!connected && (
						<div className="answer-box">
							<label htmlFor="answer">
								{config.mode === "interview" ? "나의 답변" : "발표 내용"}
							</label>
							<textarea
								id="answer"
								placeholder="답변을 입력해 주세요. Ctrl + Enter로 제출할 수 있어요."
								maxLength={8000}
								value={answer}
								disabled={busy || paused}
								onChange={(e) => setAnswer(e.target.value)}
								onKeyDown={(e) => {
									if (
										(e.ctrlKey || e.metaKey) &&
										e.key === "Enter" &&
										answer.trim() &&
										!paused
									) {
										e.preventDefault();
										void turn("followup");
									}
								}}
							/>
							<div>
								<small>{answer.length.toLocaleString()} / 8,000</small>
								<Button
									busy={busy}
									disabled={paused || (messages.length > 0 && !answer.trim())}
									onClick={() =>
										void turn(
											messages.length
												? config.mode === "presentation"
													? "interrupt"
													: "followup"
												: "start",
										)
									}
								>
									{messages.length
										? config.retry
											? "답변 제출 · 결과 확인"
											: config.mode === "presentation"
												? "발표 제출하고 질문 받기"
												: "답변 제출"
										: "첫 질문 받기"}
								</Button>
							</div>
						</div>
					)}
					{connected && config.mode === "presentation" && !config.retry && (
						<Button disabled={paused} onClick={() => voice.askQuestion()}>
							지금 반박 질문 받기
						</Button>
					)}
				</section>
				<aside className="practice-aside">
					{(camera.stream || camera.analysis || camera.error) && (
						<CameraSessionPanel
							camera={camera}
							enabled={cameraEnabled}
							connected={connected}
							disabled={!started || paused || busy}
							onToggle={() => setCameraManual((v) => !v)}
						/>
					)}
					<section className="form-panel">
						<h2>마이크 말하기 분석</h2>
						<p className="context-hint">
							조용한 곳에서 10초 이상 말해 보세요. 음성 연결 시에도 분석을
							시도합니다. AI 발화·일시 정지 중에는 측정을 쉽니다. 원본 음성은
							저장하지 않아요.
						</p>
						<div className="session-controls">
							<Button
								variant="secondary"
								busy={coach.connecting}
								disabled={connected || busy}
								onClick={() => {
									if (coach.active) coach.stop();
									else void coach.start();
								}}
							>
								{coach.active ? "분석 마치기" : "말하기 분석 시작"}
							</Button>
						</div>
						{coach.active && (
							<p role="status">
								마이크 분석 중 · {Math.floor(coach.seconds)}초
							</p>
						)}
						{coach.error && (
							<p className="error-box" role="alert">
								{coach.error}
							</p>
						)}
						<VoiceFeedback analysis={coach.analysis} />
					</section>
					{config.mode === "interview" && (
						<EmployerMaterials context={config.interviewContext} />
					)}
					<section className="form-panel">
						<h2>오늘의 연습 자료</h2>
						<p className="material-text">{config.material}</p>
					</section>
					<section className="form-panel">
						<h2>연습 안내</h2>
						{config.practiceStyle !== "simulation" &&
							messages.some((m) => m.role === "assistant") && (
								<div className="hint-panel">
									<h3>답변이 막혔나요?</h3>
									<p>힌트 사용 단계는 답변과 함께 기록됩니다.</p>
									<Button
										variant="secondary"
										disabled={busy || paused || hintsUsed >= hints.length}
										onClick={() => setHintsUsed((n) => Math.min(3, n + 1))}
									>
										{hintsUsed >= 3
											? "힌트를 모두 확인했어요"
											: `힌트 ${hintsUsed + 1}단계 보기`}
									</Button>
									<ol aria-live="polite">
										{hints.slice(0, hintsUsed).map((hint) => (
											<li key={hint}>{hint}</li>
										))}
									</ol>
								</div>
							)}
						<p>실제 경험과 확인 가능한 근거를 중심으로 답해 보세요.</p>
						<p>
							음성을 다시 연결하면 확정된 대화를 전달해 이어갑니다. 텍스트로도
							계속할 수 있어요. 대화와 입력 중인 글은 이 브라우저에 임시
							저장됩니다.
						</p>
						{config.mode === "presentation" && (
							<p>
								음성 발표 중에는 확정 자막에서 성능·수요·안전·차별성 주장을
								찾아, 발화가 멈춘 뒤 질문합니다. 질문 간 최소 간격은{" "}
								{config.difficulty === "pressure"
									? "25"
									: config.difficulty === "gentle"
										? "75"
										: "45"}
								초이며 같은 주장은 반복 질문하지 않습니다. 모든 주장을 감지하는
								것은 아니며 수동 질문도 가능합니다.
							</p>
						)}
					</section>
				</aside>
			</div>
			{seconds >= config.durationMinutes * 60 && (
				<p role="status">
					목표 시간에 도달했어요. 연습을 마치거나 조금 더 이어갈 수 있어요.
				</p>
			)}
		</div>
	);
}
