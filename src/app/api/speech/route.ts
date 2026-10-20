import { z } from "zod";
import { client } from "@/lib/server/ai";
import { endpoint, jsonBody, signal } from "@/lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
const speechSchema = z.object({ text: z.string().trim().min(1).max(2_000) });
export async function POST(request: Request): Promise<Response> {
	return endpoint(request, async () => {
		const { text } = await jsonBody(request, speechSchema);
		const result = await client().audio.speech.create(
			{
				model: "gpt-4o-mini-tts",
				voice: "marin",
				input: text,
				response_format: "mp3",
				instructions:
					"자연스러운 한국어로, 차분하고 전문적인 면접관처럼 명확하게 말하세요.",
			},
			{ signal: signal(request) },
		);
		return new Response(await result.arrayBuffer(), {
			headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
		});
	});
}
