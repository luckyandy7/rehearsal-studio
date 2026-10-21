"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraController } from "@/hooks/use-camera-analysis";
import { useRealtime } from "@/hooks/use-realtime";
import { useVoiceAnalysis } from "@/hooks/use-voice-analysis";
import { api, errorMessage } from "@/lib/api";
import { demoQuestion } from "@/lib/demo-question";
import { questionSchema } from "@/lib/interview-context";
import {
	type Message,
	type PracticeRecord,
	reportSchema,
	type SessionConfig,
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
}: {
	config: SessionConfig;
	camera: CameraController;
	onComplete: (record: PracticeRecord) => void;
}) {
	const [cameraManual, setCameraManual] = useState(false);
	const [userSpeaking, setUserSpeaking] = useState(false);
	const [messages, setMessages] = useState<Message[]>([]);
	const [answer, setAnswer] = useState("");
	const [busy, setBusy] = useState(false);
	const [finishing, setFinishing] = useState(false);
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => {
		heading.current?.focus();
	}, []);
	const [error, setError] = useState("");
	const [started, setStarted] = useState(false);
	const [paused, setPaused] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const controller = useRef<AbortController | null>(null);
	const end = useRef<HTMLDivElement>(null);
	const sampleEnabled = useRef(true);
	const coach = useVoiceAnalysis(() => sampleEnabled.current);
	const onMessage = useCallback(
		(message: Message) => {
			if (message.role === "user") coach.addTranscript(message.content);
			setMessages((previous) => [...previous, message]);
		},
		[coach.addTranscript],
	);
	const voice = useRealtime({
		config,
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
	useEffect(() => {
		if (!connected || config.mode !== "presentation" || paused) return;
		const timer = setInterval(
			voice.askQuestion,
			config.difficulty === "pressure"
				? 25000
				: config.difficulty === "gentle"
					? 75000
					: 45000,
		);
		return () => clearInterval(timer);
	}, [connected, config.mode, config.difficulty, paused, voice.askQuestion]);
	const turn = async (action: "start" | "followup" | "interrupt") => {
		if (busy) return;
		const next: Message[] = answer.trim()
			? [...messages, { role: "user", content: answer.trim() }]
			: messages;
		if (next.length >= 78) {
			setError("대화가 충분히 쌓였어요. 연습을 마치고 리포트를 확인해 주세요.");
			return;
		}
		setCameraManual(false);
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
		const cameraAnalysis = camera.stop();
		const voiceAnalysis = coach.stop() ?? coach.analysis;
		voice.disconnect();
		setPaused(true);
		setBusy(true);
		setError("");
		const next: Message[] = answer.trim()
			? [...messages, { role: "user", content: answer.trim() }]
			: messages;
		setMessages(next);
		setAnswer("");
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
			</section>
			{config.provider === "demo" && (
				<p className="demo-banner">
					데모 체험 · 준비된 질문 틀에 입력 자료를 넣습니다. 실제 AI·음성 연결은
					사용하지 않습니다.
				</p>
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
									disabled={busy || (messages.length > 0 && !connected)}
									onClick={() => {
										if (connected) {
											coach.stop();
											voice.disconnect();
										} else {
											coach.stop();
											setStarted(true);
											setPaused(false);
											void voice.connect();
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
										? config.mode === "presentation"
											? "발표 제출하고 질문 받기"
											: "답변 제출"
										: "첫 질문 받기"}
								</Button>
							</div>
						</div>
					)}
					{connected && config.mode === "presentation" && (
						<Button disabled={paused} onClick={voice.askQuestion}>
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
						<p>실제 경험과 확인 가능한 근거를 중심으로 답해 보세요.</p>
						<p>
							음성 연습은 새 세션의 첫 단계에서 시작합니다. 음성을 종료하면
							자막을 바탕으로 텍스트 연습을 이어갈 수 있어요.
						</p>
						{config.mode === "presentation" && (
							<p>
								음성 발표 중에는{" "}
								{config.difficulty === "pressure"
									? "25"
									: config.difficulty === "gentle"
										? "75"
										: "45"}
								초마다 질문을 시도합니다. AI가 말하는 동안에는 중복 질문하지
								않습니다.
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
