import { zodTextFormat } from "openai/helpers/zod";
import { questionSchema, verifiedSources } from "@/lib/interview-context";
import { client, textModel } from "@/lib/server/ai";
import { endpoint, HttpError, jsonBody, signal } from "@/lib/server/http";
import { instructions, turnSchema } from "@/lib/server/schemas";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
	return endpoint(request, async () => {
		const input = await jsonBody(request, turnSchema);
		const actions = {
			start:
				"연습의 첫 질문을 하세요. 발표 모드이면 발표를 시작하도록 짧게 안내하세요.",
			followup: "마지막 답변을 듣고 꼬리 질문 하나를 하세요.",
			interrupt:
				"발표자의 마지막 주장에서 부족한 근거를 짚으며 짧게 끼어들어 반박 질문 하나를 하세요.",
		};
		const result = await client().responses.parse(
			{
				model: textModel(),
				store: false,
				max_output_tokens: 1000,
				text: { format: zodTextFormat(questionSchema, "practice_question") },
				instructions: `${instructions(input)}\n현재 행동: ${actions[input.action]}\n질문을 text에 넣으세요. sources에는 질문에 실제 사용한 자료의 짧은 원문 인용(240자 이하)을 최대 3개 넣으세요. kind는 jobPosting, companyInfo, companyValues, resume 중 하나입니다. 원문을 그대로 복사하고 없는 문구를 만들지 마세요. 면접에서 기업 자료가 있으면 관련 기업 자료와 이력서의 연결 근거를 선택하세요. 근거가 없으면 빈 배열로 반환하세요.`,
				input: JSON.stringify(input),
			},
			{ signal: signal(request) },
		);
		const text = result.output_parsed?.text.trim();
		if (!text || result.status !== "completed")
			throw new HttpError(
				502,
				"질문 생성이 완료되지 않았습니다. 다시 시도해 주세요.",
			);
		return Response.json(
			{
				text,
				sources: verifiedSources(input, result.output_parsed?.sources ?? []),
			},
			{ headers: { "Cache-Control": "no-store" } },
		);
	});
}
