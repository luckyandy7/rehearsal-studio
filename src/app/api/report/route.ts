import { zodTextFormat } from "openai/helpers/zod";
import { client, textModel } from "@/lib/server/ai";
import { endpoint, HttpError, jsonBody, signal } from "@/lib/server/http";
import {
	instructions,
	reportSchema,
	sessionSchema,
} from "@/lib/server/schemas";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
	return endpoint(request, async () => {
		const input = await jsonBody(request, sessionSchema);
		const answers = input.messages.filter((message) => message.role === "user");
		if (!answers.length)
			throw new HttpError(
				400,
				"답변을 한 번 이상 남겨야 피드백을 만들 수 있습니다.",
			);
		const result = await client().responses.parse(
			{
				model: textModel(),
				store: false,
				max_output_tokens: 2200,
				instructions: `${instructions(input)}\n지금은 질문 대신 연습 결과 보고서를 작성합니다. 실제 사용자 답변만 평가하세요. 음성 톤, 시선, 자세는 관찰하지 못했으므로 평가하지 마세요. summary는 짧은 요약, strengths와 improvements는 각각 최대 3개, exercises는 실행 가능한 다음 연습 최대 3개입니다. evidence는 사용자 답변에서 그대로 복사한 짧은 원문 quote와 개선 피드백 feedback 최대 3개입니다. 답변이 짧으면 평가 한계를 명시하세요. 취업 성공 점수나 근거 없는 수치 평점을 만들지 마세요.`,
				input: JSON.stringify(input),
				text: { format: zodTextFormat(reportSchema, "practice_report") },
			},
			{ signal: signal(request) },
		);
		if (!result.output_parsed || result.status !== "completed")
			throw new HttpError(
				502,
				"피드백 생성이 완료되지 않았습니다. 다시 시도해 주세요.",
			);
		const report = result.output_parsed;
		const evidence = report.evidence
			.filter(
				(item) =>
					item.quote.trim() &&
					answers.some((answer) => answer.content.includes(item.quote)),
			)
			.slice(0, 3);
		return Response.json(
			{
				...report,
				evidence,
				strengths: report.strengths.slice(0, 3),
				improvements: report.improvements.slice(0, 3),
				exercises: report.exercises.slice(0, 3),
			},
			{ headers: { "Cache-Control": "no-store" } },
		);
	});
}
