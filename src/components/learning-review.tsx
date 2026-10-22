"use client";
import { cameraAdvice, cameraLabels, cameraTime } from "@/lib/camera-analysis";
import {
	answerPairs,
	changeLabels,
	coverageLabels,
	criteria,
} from "@/lib/learning";
import type { PracticeRecord, SessionConfig } from "@/lib/types";
import { Button } from "./ui";
import { VoiceFeedback } from "./voice-feedback";
import "./learning.css";

export function LearningReview({
	record,
	onRetry,
}: {
	record: PracticeRecord;
	onRetry: (config: SessionConfig) => void;
}) {
	const pairs = answerPairs(record.messages);
	const retry = record.config.retry;
	return (
		<div className="screen-stack">
			{retry?.previousAnswer && (
				<section className="form-panel">
					<h2>같은 질문의 전후 비교</h2>
					<p>{retry.question}</p>
					<div className="comparison-grid">
						<article>
							<h3>이전 답변</h3>
							<p>{retry.previousAnswer}</p>
							<small>힌트 {retry.previousHints}단계 사용</small>
						</article>
						<article>
							<h3>이번 답변</h3>
							<p>
								{pairs.map((pair) => pair.answer.content).join("\n\n") ||
									"답변 없음"}
							</p>
							<small>
								힌트{" "}
								{Math.max(
									0,
									...pairs.map((pair) => pair.answer.hintsUsed ?? 0),
								)}
								단계 사용
							</small>
						</article>
					</div>
					{retry.criteria.map((criterion) => {
						const result = record.report.comparison?.find(
							(item) => item.criterion === criterion,
						);
						return (
							<article className="learning-item" key={criterion}>
								<h3>{criterion}</h3>
								{result ? (
									<>
										<strong>{changeLabels[result.change]}</strong>
										<p>{result.feedback}</p>
										<p>이전 근거: {result.beforeQuote || "확인되지 않음"}</p>
										<p>이번 근거: {result.afterQuote || "확인되지 않음"}</p>
									</>
								) : (
									<p>
										{record.config.provider === "demo"
											? "데모에서는 자동 비교를 수행하지 않아요. 두 답변을 직접 비교해 보세요."
											: "이 기준의 비교 근거가 충분하지 않아 결과를 표시하지 않았어요."}
									</p>
								)}
							</article>
						);
					})}
				</section>
			)}
			{record.config.mode === "interview" && (
				<section className="form-panel">
					<h2>공고의 요구 역량, 어디까지 설명했나요?</h2>
					<p>
						이번 대화에서 확인한 근거입니다. 역량 보유 여부나 채용 적합성을
						판정하지 않아요.
					</p>
					{record.report.coverage?.length ? (
						record.report.coverage.map((item, index) => (
							<article
								className="learning-item"
								key={`${index}-${item.requirement}`}
							>
								<h3>{item.requirement}</h3>
								<span className="tag">{coverageLabels[item.status]}</span>
								<blockquote>공고 원문: {item.sourceQuote}</blockquote>
								{item.quote && (
									<p>
										답변 {item.answerNumber}: “{item.quote}”
									</p>
								)}
								<p>{item.feedback}</p>
								{item.status !== "evidenced" && item.question.trim() && (
									<Button
										variant="secondary"
										onClick={() =>
											onRetry({
												...record.config,
												retry: {
													question: item.question,
													previousAnswer: "",
													previousHints: 0,
													criteria: [item.requirement],
												},
											})
										}
									>
										이 역량 집중 연습
									</Button>
								)}
							</article>
						))
					) : (
						<p>
							{!record.config.interviewContext.jobPosting
								? "채용공고를 넣으면 요구 역량과 답변의 연결을 확인할 수 있어요."
								: record.config.provider === "demo"
									? "데모에서는 공고 역량을 AI로 평가하지 않아요."
									: "확인된 공고 원문 근거가 없거나, 이 기능 추가 전에 생성한 리포트예요."}
						</p>
					)}
				</section>
			)}
			<section className="form-panel">
				<h2>질문별 복습과 재도전</h2>
				<p>
					답변·피드백·말하기·카메라 관찰을 함께 확인하고, 같은 질문에 다시 답해
					보세요.
				</p>
				{pairs.map(({ number, question, answer }) => {
					const feedback =
						record.report.answerFeedback?.filter(
							(item) => item.answerNumber === number,
						) ?? [];
					const evidence = feedback.length
						? feedback
						: record.report.evidence.filter((item) =>
								answer.content.includes(item.quote),
							);
					const events =
						record.cameraAnalysis?.events.filter(
							(event) => event.answer === number,
						) ?? [];
					return (
						<details
							className="learning-item"
							key={number}
							open={pairs.length === 1 ? true : undefined}
						>
							<summary>
								답변 {number} · {question?.content ?? "질문 전 발표"}
							</summary>
							<p className="review-answer">{answer.content}</p>
							<p className="context-hint">
								힌트 {answer.hintsUsed ?? 0}단계 사용
								{answer.atSeconds !== undefined
									? ` · 연습 ${cameraTime(answer.atSeconds)} 시점에 기록`
									: ""}
							</p>
							{question?.trigger && (
								<p>
									질문을 만든 발언: “{question.trigger.quote}” ·{" "}
									{question.trigger.reason}
								</p>
							)}
							<h3>이 답변의 근거 피드백</h3>
							{evidence.length ? (
								evidence.map((item, index) => (
									<article key={`${index}-${item.quote}`}>
										<blockquote>{item.quote}</blockquote>
										<p>{item.feedback}</p>
									</article>
								))
							) : (
								<p>이 답변에 연결된 피드백 근거가 없습니다.</p>
							)}
							<h3>이 답변의 말하기</h3>
							{answer.voiceAnalysis ? (
								<VoiceFeedback analysis={answer.voiceAnalysis} />
							) : (
								<p>
									답변별 마이크 측정 기록이 없습니다. 텍스트 길이로 말하기
									품질을 추정하지 않아요.
								</p>
							)}
							<h3>이 답변의 시선·자세 관찰</h3>
							{events.length ? (
								<ul>
									{events.map((event, index) => (
										<li key={`${index}-${event.start}`}>
											{cameraTime(event.start)}–{cameraTime(event.end)} ·{" "}
											{cameraLabels[event.kind]}:{" "}
											{cameraAdvice(
												event.kind,
												record.cameraAnalysis?.settings.reference ?? "allowed",
											)}
										</li>
									))}
								</ul>
							) : (
								<p>
									연결된 관찰 구간이 없습니다. 미측정이나 측정 부족일 수 있어요.
								</p>
							)}
							{question && (
								<Button
									onClick={() =>
										onRetry({
											...record.config,
											retry: {
												question: question.content,
												previousAnswer: answer.content,
												previousHints: answer.hintsUsed ?? 0,
												criteria: retry?.criteria ?? criteria,
											},
										})
									}
								>
									이 답변 다시 연습하기
								</Button>
							)}
						</details>
					);
				})}
			</section>
		</div>
	);
}
