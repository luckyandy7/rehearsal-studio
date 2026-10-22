import { z } from "zod";
import { cameraAdvice, cameraLabels, cameraTime } from "./camera-analysis";
import { sourceLabels } from "./interview-context";
import { changeLabels, coverageLabels } from "./learning";
import {
	draftSchema,
	type PracticeRecord,
	recordSchema,
	type SessionDraft,
} from "./types";
import { voiceSuggestions } from "./voice-analysis";

const KEY = "rehearsal-records-v1";
const DRAFT_KEY = "rehearsal-draft-v1";
export function readDraft(): SessionDraft | null {
	const raw = localStorage.getItem(DRAFT_KEY);
	if (!raw) return null;
	try {
		const parsed = draftSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}
export function writeDraft(draft: SessionDraft) {
	localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
export function clearDraft() {
	localStorage.removeItem(DRAFT_KEY);
}
export function readRecords(): PracticeRecord[] {
	const raw = localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed = z.array(recordSchema).safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : [];
	} catch (error) {
		if (error instanceof SyntaxError) return [];
		throw error;
	}
}
export function writeRecords(records: readonly PracticeRecord[]): void {
	localStorage.setItem(KEY, JSON.stringify(records.slice(0, 30)));
}
export function exportRecord(record: PracticeRecord): void {
	const learningText = `\n\n## 질문별 복습\n${(record.report.answerFeedback ?? []).map((item) => `### 답변 ${item.answerNumber}\n> ${item.quote}\n\n${item.feedback}`).join("\n\n")}\n\n## 공고 요구 역량\n${(record.report.coverage ?? []).map((item) => `- ${item.requirement}: ${coverageLabels[item.status]}\n  공고: ${item.sourceQuote}\n  답변 ${item.answerNumber || "미확인"}: ${item.quote}\n  ${item.feedback}\n  다음 질문: ${item.question}`).join("\n")}\n\n## 재도전 비교\n${(record.report.comparison ?? []).map((item) => `- ${item.criterion}: ${changeLabels[item.change]}\n  이전: ${item.beforeQuote}\n  이번: ${item.afterQuote}\n  ${item.feedback}`).join("\n")}\n\n${record.messages
		.filter((m) => m.role === "user")
		.map(
			(m, i) =>
				`답변 ${i + 1}: 힌트 ${m.hintsUsed ?? 0}단계 사용${m.voiceAnalysis ? ` · 말하기 측정 ${m.voiceAnalysis.analysedSeconds}초` : ""}`,
		)
		.join("\n")}\n${record.messages
		.filter((m) => m.trigger)
		.map((m) => `반박 근거: ${m.trigger?.quote} (${m.trigger?.reason})`)
		.join("\n")}`;
	const urlText = record.config.interviewContext.sourceUrls
		? `\n\n## 참고 URL\n${(
				["jobPosting", "companyInfo", "companyValues"] as const
			)
				.filter((kind) => record.config.interviewContext.sourceUrls?.[kind])
				.map(
					(kind) =>
						`- ${sourceLabels[kind]}: ${record.config.interviewContext.sourceUrls?.[kind]}`,
				)
				.join("\n")}`
		: "";
	const voiceText = record.voiceAnalysis
		? `\n\n## 말하기 분석 (마이크 신호 추정)\n측정 시간: ${record.voiceAnalysis.analysedSeconds}초\n${voiceSuggestions(
				record.voiceAnalysis,
			)
				.map((item) => `- ${item.observation} ${item.suggestion}`)
				.join("\n")}`
		: "";
	const cameraText = record.cameraAnalysis
		? `\n\n## 시선·자세 코칭 (기기 내 추정)\n측정 ${record.cameraAnalysis.sampledSeconds}초 · 얼굴 측정 ${record.cameraAnalysis.faceSeconds}초 · ${record.cameraAnalysis.sufficient ? "측정 가능" : "측정 부족"}\n글 읽기·부정행위·감정·채용 적합성을 판정하지 않습니다. 시간은 연습방 입장 이후 기준입니다.\n${record.cameraAnalysis.events.map((e) => `- ${cameraTime(e.start)}–${cameraTime(e.end)} · 답변 ${e.answer} · ${cameraLabels[e.kind]}: ${cameraAdvice(e.kind, record.cameraAnalysis?.settings.reference ?? "allowed")}`).join("\n")}`
		: "";
	const text = `# ${record.config.role} · ${record.config.mode === "interview" ? "면접" : "발표"} 리포트\n\n${record.report.summary}${voiceText}${cameraText}${urlText}\n\n## 잘한 점\n${record.report.strengths.map((x) => `- ${x}`).join("\n")}\n\n## 개선할 점\n${record.report.improvements.map((x) => `- ${x}`).join("\n")}\n\n## 다음 연습\n${record.report.exercises.map((x) => `- ${x}`).join("\n")}\n\n## 발언 근거\n${record.report.evidence.map((x) => `> ${x.quote}\n\n${x.feedback}`).join("\n\n")}\n\n## 대화 기록\n${record.messages.map((m) => `**${m.role === "user" ? "나" : "AI"}**: ${m.content}${m.sources?.length ? `\n\n질문 출처:\n${m.sources.map((source) => `- ${sourceLabels[source.kind]}: ${source.quote}`).join("\n")}` : ""}`).join("\n\n")}`;
	const url = URL.createObjectURL(
		new Blob([text, learningText], { type: "text/markdown;charset=utf-8" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = `rehearsal-${record.id}.md`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
