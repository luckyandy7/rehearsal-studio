import { z } from "zod";

export const interviewContextSchema = z.object({
	jobPosting: z.string().trim().max(8000).default(""),
	companyInfo: z.string().trim().max(4000).default(""),
	companyValues: z.string().trim().max(4000).default(""),
});
export const emptyInterviewContext = {
	jobPosting: "",
	companyInfo: "",
	companyValues: "",
};
export type InterviewContext = z.infer<typeof interviewContextSchema>;
export const questionSourceSchema = z.object({
	kind: z.enum(["jobPosting", "companyInfo", "companyValues", "resume"]),
	quote: z.string(),
});
export type QuestionSource = z.infer<typeof questionSourceSchema>;
export const sourceLabels = {
	jobPosting: "채용공고",
	companyInfo: "기업 정보",
	companyValues: "가치관·인재상",
	resume: "이력서·자기소개서",
};
export const questionSchema = z.object({
	text: z.string(),
	sources: z.array(questionSourceSchema),
});
export function sourceText(
	input: {
		readonly material: string;
		readonly interviewContext: InterviewContext;
	},
	kind: QuestionSource["kind"],
): string {
	return kind === "resume" ? input.material : input.interviewContext[kind];
}
export function verifiedSources(
	input: {
		readonly material: string;
		readonly interviewContext: InterviewContext;
	},
	sources: readonly QuestionSource[],
): QuestionSource[] {
	const seen = new Set<string>();
	return sources
		.filter((source) => {
			const key = `${source.kind}:${source.quote}`;
			if (
				source.quote.trim().length < 2 ||
				source.quote.length > 240 ||
				!sourceText(input, source.kind).includes(source.quote) ||
				seen.has(key)
			)
				return false;
			seen.add(key);
			return true;
		})
		.slice(0, 3);
}
