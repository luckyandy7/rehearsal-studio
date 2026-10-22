import type { Report } from "../types";
import type { SessionInput } from "./schemas";

export const learningInstructions = `추가로 answerFeedback에 각 사용자 답변 순서(answerNumber는 1부터), 해당 답변에서 복사한 quote, 구체적인 feedback을 작성하세요. 힌트를 사용했다면 독립적으로 답한 것처럼 평가하지 마세요.
coverage는 면접의 jobPosting 원문에서 요구 역량을 최대 8개 고르고 requirement, 정확한 sourceQuote, status(evidenced=구체적인 근거 있음, partial=언급만 함, unobserved=이번 답변에서 확인 안 됨), answerNumber, 사용자 원문 quote, feedback, 그 역량을 연습할 question을 작성하세요. 근거가 없으면 answerNumber=0, quote=""로 작성하세요. 능력이 없다고 판단하지 말고 이번 대화에서 확인되지 않았다고 표현하세요. 공고가 없거나 발표 모드이면 빈 배열입니다.
retry가 있으면 동일한 retry.question에 대한 이전 previousAnswer와 이번 사용자 답변 전체를 retry.criteria 각각의 고정 기준으로 비교하세요. 음성 답변은 여러 자막 구간으로 나뉠 수 있습니다. comparison에 criterion, beforeQuote, afterQuote, change(improved/similar/needs_work/insufficient), feedback을 작성하세요. 인용은 각 답변의 정확한 원문이어야 합니다. 근거가 부족하면 빈 인용과 insufficient를 사용하세요. 이전/현재 힌트 사용 여부를 고려하고 없는 성과나 숫자를 보완하지 마세요. retry가 없거나 previousAnswer가 비어 있으면 comparison은 빈 배열입니다.`;

export function verifiedLearning(input: SessionInput, report: Report) {
	const answers = input.messages.filter((m) => m.role === "user");
	const coverage =
		input.mode === "interview" && input.interviewContext.jobPosting
			? (report.coverage ?? [])
					.filter(
						(item) =>
							item.sourceQuote.trim() &&
							input.interviewContext.jobPosting.includes(item.sourceQuote),
					)
					.map((item) => {
						const valid =
							item.quote.trim() &&
							answers[item.answerNumber - 1]?.content.includes(item.quote);
						return valid && item.status !== "unobserved"
							? item
							: {
									...item,
									status: "unobserved" as const,
									quote: "",
									answerNumber: 0,
									feedback:
										"이번 답변에서 확인할 수 있는 원문 근거가 없습니다.",
								};
					})
			: [];
	const answerFeedback = (report.answerFeedback ?? []).filter(
		(item) =>
			item.quote.trim() &&
			answers[item.answerNumber - 1]?.content.includes(item.quote),
	);
	const retry = input.retry;
	const comparison = retry?.previousAnswer
		? (report.comparison ?? [])
				.filter((item) => retry.criteria.includes(item.criterion))
				.map((item) => {
					const beforeValid =
						item.beforeQuote.trim() &&
						retry.previousAnswer.includes(item.beforeQuote);
					const afterValid =
						item.afterQuote.trim() &&
						answers.some((answer) => answer.content.includes(item.afterQuote));
					return beforeValid && afterValid
						? item
						: {
								...item,
								beforeQuote: beforeValid ? item.beforeQuote : "",
								afterQuote: afterValid ? item.afterQuote : "",
								change: "insufficient" as const,
								feedback:
									"두 답변에서 비교할 수 있는 원문 근거가 충분하지 않습니다.",
							};
				})
		: [];
	return { coverage, answerFeedback, comparison };
}
