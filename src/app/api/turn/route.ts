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
		const result = await client().responses.create(
			{
				model: textModel(),
				store: false,
				max_output_tokens: 400,
				instructions: `${instructions(input)}\n현재 행동: ${actions[input.action]}`,
				input: JSON.stringify(input),
			},
			{ signal: signal(request) },
		);
		const text = result.output_text.trim();
		if (!text || result.status !== "completed")
			throw new HttpError(
				502,
				"질문 생성이 완료되지 않았습니다. 다시 시도해 주세요.",
			);
		return Response.json(
			{ text },
			{ headers: { "Cache-Control": "no-store" } },
		);
	});
}
