"use client";
import {
	ArrowClockwise,
	ArrowLeft,
	CheckCircle,
	DownloadSimple,
	Quotes,
	Target,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button, ProgressRing } from "@/components/ui";
import { exportRecord } from "@/lib/storage";
import {
	modeLabels,
	type PracticeRecord,
	type SessionConfig,
} from "@/lib/types";
import { CameraFeedback } from "./camera-feedback";
import { EmployerMaterials, QuestionSources } from "./employer-context";
import { VoiceFeedback } from "./voice-feedback";
import "./screens.css";

type Props = {
	readonly record: PracticeRecord;
	readonly onBack: () => void;
	readonly onRetry: (config: SessionConfig) => void;
};
export function ReportView({ record, onBack, onRetry }: Props) {
	const [tab, setTab] = useState<"feedback" | "transcript" | "camera">(
		"feedback",
	);
	const answers = record.messages.filter(
		(message) => message.role === "user",
	).length;
	const progress = Math.min(
		100,
		Math.round(
			(record.elapsedSeconds / (record.config.durationMinutes * 60)) * 100,
		),
	);
	return (
		<div className="screen-stack">
			<Button className="back-action" variant="ghost" onClick={onBack}>
				<ArrowLeft /> 돌아가기
			</Button>
			<header className="history-heading">
				<div className="screen-heading compact">
					<span className="eyebrow">SESSION REVIEW</span>
					<h1>오늘의 리허설을 돌아볼까요?</h1>
					<p>
						{record.config.role} · {modeLabels[record.config.mode]} ·{" "}
						{new Date(record.createdAt).toLocaleDateString("ko-KR")}
					</p>
				</div>
				<div className="report-actions">
					<Button variant="secondary" onClick={() => exportRecord(record)}>
						<DownloadSimple size={18} /> 리포트 저장
					</Button>
					<Button onClick={() => onRetry(record.config)}>
						<ArrowClockwise size={18} /> 다시 연습
					</Button>
				</div>
			</header>
			{record.config.provider === "demo" && (
				<p className="demo-banner">
					데모 체험 리포트입니다. 미리 준비된 피드백이며 실제 AI 평가가
					아닙니다.
				</p>
			)}
			<section className="report-overview">
				<div>
					<span className="eyebrow">TODAY’S TAKEAWAY</span>
					<h2>연습이 남긴 한 가지</h2>
					<p>{record.report.summary}</p>
					<div className="session-facts">
						<span>
							답변 <strong>{answers}회</strong>
						</span>
						<span>
							연습 시간{" "}
							<strong>
								{Math.floor(record.elapsedSeconds / 60)}분{" "}
								{record.elapsedSeconds % 60}초
							</strong>
						</span>
						<span>
							목표 <strong>{record.config.durationMinutes}분</strong>
						</span>
					</div>
				</div>
				<div className="completion-ring">
					<ProgressRing value={progress} label="목표 시간 달성" />
					<span className="ring-caption">목표 시간 달성</span>
					<small>실력 점수가 아닌 연습 시간 비율</small>
				</div>
			</section>
			{record.voiceAnalysis && (
				<section className="form-panel">
					<VoiceFeedback analysis={record.voiceAnalysis} />
				</section>
			)}
			<div className="report-tabs">
				<button
					type="button"
					aria-pressed={tab === "feedback"}
					onClick={() => setTab("feedback")}
				>
					피드백
				</button>
				<button
					type="button"
					aria-pressed={tab === "camera"}
					aria-label={`시선·자세${record.cameraAnalysis ? " · 측정 결과" : " · 미사용"}`}
					onClick={() => setTab("camera")}
				>
					시선·자세
				</button>
				<button
					type="button"
					aria-pressed={tab === "transcript"}
					onClick={() => setTab("transcript")}
				>
					대화 기록 <span>{record.messages.length}</span>
				</button>
			</div>
			{tab === "camera" ? (
				<CameraFeedback
					analysis={record.cameraAnalysis}
					messages={record.messages}
				/>
			) : tab === "feedback" ? (
				<div className="screen-stack">
					<div className="feedback-grid">
						<section className="form-panel feedback-positive">
							<h2>
								<CheckCircle size={23} /> 잘한 점
							</h2>
							<ul>
								{record.report.strengths.map((item, index) => (
									<li key={`${index}-${item}`}>{item}</li>
								))}
							</ul>
						</section>
						<section className="form-panel">
							<h2>
								<Target size={23} /> 다음에 바꿔볼 점
							</h2>
							<ul className="feedback-list">
								{record.report.improvements.map((item, index) => (
									<li key={`${index}-${item}`}>{item}</li>
								))}
							</ul>
						</section>
					</div>
					<section className="form-panel">
						<h2>
							<Quotes size={23} /> 내 답변에서 찾은 근거
						</h2>
						{record.report.evidence.length === 0 ? (
							<p className="muted-text">
								아직 구체적인 발언 근거가 충분하지 않아요. 다음 연습에서 경험과
								결과를 조금 더 자세히 말해 보세요.
							</p>
						) : (
							<div className="evidence-list">
								{record.report.evidence.map((item, index) => (
									<article key={`${index}-${item.quote}`}>
										<blockquote>“{item.quote}”</blockquote>
										<p>{item.feedback}</p>
									</article>
								))}
							</div>
						)}
					</section>
					<section className="next-exercises">
						<span className="eyebrow">YOUR NEXT STEP</span>
						<h2>다음 리허설에서는</h2>
						<ol>
							{record.report.exercises.map((item, index) => (
								<li key={`${index}-${item}`}>{item}</li>
							))}
						</ol>
						<Button variant="secondary" onClick={() => onRetry(record.config)}>
							같은 자료로 한 번 더 <ArrowClockwise size={18} />
						</Button>
					</section>
				</div>
			) : (
				<section className="form-panel">
					<h2>전체 대화</h2>
					{record.config.mode === "interview" && (
						<EmployerMaterials context={record.config.interviewContext} />
					)}
					<div className="report-transcript">
						{record.messages.length === 0 ? (
							<p>저장된 대화가 없습니다.</p>
						) : (
							record.messages.map((message, index) => (
								<article
									key={`${index}-${message.role}`}
									className={`transcript-entry ${message.role}`}
								>
									<span>
										{message.role === "user" ? "나의 답변" : "AI 질문"}
									</span>
									<p>{message.content}</p>
									<QuestionSources sources={message.sources} />
								</article>
							))
						)}
					</div>
				</section>
			)}
			<p className="storage-note">
				AI 피드백은 연습을 돕기 위한 참고 자료입니다. 채용 결과나 실제 심사
				점수를 예측하지 않습니다.
			</p>
		</div>
	);
}
