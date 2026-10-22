import { z } from "zod";
import type { CameraAnalysis, CameraSettings } from "./camera-analysis";
import type { Message } from "./types";

export function mergeCamera(
	previous: CameraAnalysis | undefined,
	current: CameraAnalysis | null,
	offset: number,
	settings?: CameraSettings,
): CameraAnalysis | undefined {
	if (!previous)
		return current
			? { ...current, settings: settings ?? current.settings }
			: undefined;
	if (!current) return { ...previous, settings: settings ?? previous.settings };
	const sampledSeconds = previous.sampledSeconds + current.sampledSeconds;
	const faceSeconds = previous.faceSeconds + current.faceSeconds;
	const shift = Math.max(offset, ...previous.events.map((e) => e.end));
	const events = [
		...previous.events,
		...current.events.map((e) => ({
			...e,
			start: e.start + shift,
			end: e.end + shift,
		})),
	];
	return {
		...current,
		settings: settings ?? current.settings,
		sampledSeconds,
		faceSeconds,
		poseSeconds: previous.poseSeconds + current.poseSeconds,
		sufficient:
			faceSeconds >= 10 && faceSeconds / Math.max(1, sampledSeconds) >= 0.6,
		events: events.slice(0, 80),
		truncated: previous.truncated || current.truncated || events.length > 80,
	};
}

export const criteria = [
	"질문에 대한 직접 답변",
	"본인이 한 구체적인 행동",
	"결과와 확인 가능한 근거",
];
export const retrySchema = z.object({
	question: z.string().min(1).max(8000),
	previousAnswer: z.string().max(8000),
	criteria: z.array(z.string().min(1).max(200)).min(1).max(5),
	previousHints: z.number().int().min(0).max(3).default(0),
});
export const coverageSchema = z.object({
	requirement: z.string(),
	sourceQuote: z.string(),
	status: z.enum(["evidenced", "partial", "unobserved"]),
	answerNumber: z.number().int(),
	quote: z.string(),
	feedback: z.string(),
	question: z.string(),
});
export const answerFeedbackSchema = z.object({
	answerNumber: z.number().int(),
	quote: z.string(),
	feedback: z.string(),
});
export const comparisonSchema = z.object({
	criterion: z.string(),
	beforeQuote: z.string(),
	afterQuote: z.string(),
	change: z.enum(["improved", "similar", "needs_work", "insufficient"]),
	feedback: z.string(),
});
export const learningFields = {
	coverage: z.array(coverageSchema).max(8),
	answerFeedback: z.array(answerFeedbackSchema).max(40),
	comparison: z.array(comparisonSchema).max(5),
};
export const coverageLabels = {
	evidenced: "근거 확인",
	partial: "추가 설명 필요",
	unobserved: "이번 답변에서 미확인",
};
export const changeLabels = {
	improved: "개선 확인",
	similar: "비슷한 수준",
	needs_work: "추가 연습",
	insufficient: "판단 근거 부족",
};
export const hints = [
	"이 질문과 관련된 경험 하나를 골라보세요. 당시 어떤 상황이었나요?",
	"그 상황에서 본인이 직접 한 행동을 하나씩 설명해 보세요. 팀 전체의 행동과 구분해 보세요.",
	"그 행동 이후 무엇이 달라졌나요? 확인한 결과나 배운 점을 덧붙여 보세요. 없는 수치를 만들 필요는 없어요.",
];
export function answerPairs(messages: readonly Message[]) {
	let question: Message | undefined;
	let number = 0;
	return messages.flatMap((message) => {
		if (message.role === "assistant") {
			question = message;
			return [];
		}
		return [{ number: ++number, question, answer: message }];
	});
}
export function claimCandidate(text: string) {
	const patterns = [
		{
			pattern: /정확|빠르|빠른|성능|효율|개선|향상/,
			reason: "성능·개선 주장",
			question: "어떤 기준과 조건으로 비교했고, 결과를 어떻게 확인했나요?",
		},
		{
			pattern: /사용자|수요|필요로|많이 사용/,
			reason: "사용자 수요 주장",
			question: "실제 사용자에게 이 문제가 필요하다는 것을 어떻게 확인했나요?",
		},
		{
			pattern: /개인정보|안전|보안/,
			reason: "안전·개인정보 주장",
			question: "어떤 정보를 어디에 저장하며, 접근과 삭제는 어떻게 관리하나요?",
		},
		{
			pattern: /차별|최초|유일|경쟁/,
			reason: "차별성 주장",
			question: "기존 대안과 비교했을 때 구체적으로 어떤 차이가 있나요?",
		},
	];
	for (const sentence of text.split(/(?<=[.!?。])\s*|\n/)) {
		if (sentence.trim().length < 12) continue;
		const match = patterns.find((item) => item.pattern.test(sentence));
		if (match)
			return {
				quote: sentence.trim().slice(0, 500),
				reason: match.reason,
				question: match.question,
			};
	}
	return null;
}
