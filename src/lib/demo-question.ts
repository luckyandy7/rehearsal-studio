import { type QuestionSource, sourceText } from "./interview-context";
import type { SessionConfig } from "./types";

export function demoQuestion(
	config: SessionConfig,
	answerCount: number,
): { text: string; sources: QuestionSource[] } {
	if (config.mode === "interview") {
		const kinds = ["jobPosting", "companyValues", "companyInfo"] as const;
		const supplied = kinds.filter((kind) => config.interviewContext[kind]);
		const kind = supplied[answerCount % supplied.length];
		if (kind) {
			const quote = sourceText(config, kind).slice(0, 160);
			const resume = config.material.slice(0, 160);
			return {
				text: `제공한 기업 자료의 “${quote}”와 관련해, 이력서의 경험에서 본인이 직접 한 행동과 확인 가능한 결과를 설명해 주세요.`,
				sources: [
					{ kind, quote },
					{ kind: "resume", quote: resume },
				],
			};
		}
	}
	const questions =
		config.mode === "interview"
			? [
					"지원한 역할과 관련된 경험을 하나 소개해 주세요.",
					"그 경험에서 본인이 직접 해결한 문제는 무엇인가요?",
					"결과를 확인할 수 있는 구체적인 근거가 있나요?",
				]
			: [
					"발표의 핵심 문제와 해결 방법을 설명해 주세요.",
					"잠깐, 기존 방법보다 낫다는 근거가 무엇인가요?",
					"실제 사용자가 이 방법을 선택할 이유는 무엇인가요?",
				];
	return {
		text: questions[answerCount % questions.length] ?? "경험을 설명해 주세요.",
		sources: [],
	};
}
