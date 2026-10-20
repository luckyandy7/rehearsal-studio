import { client } from "@/lib/server/ai";
import { endpoint, HttpError, signal, upload } from "@/lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
	return endpoint(request, async () => {
		const file = await upload(request, "audio", 15 * 1024 * 1024);
		if (!/\.(webm|mp3|mp4|m4a|wav|ogg|mpeg|mpga)$/i.test(file.name)) {
			throw new HttpError(
				415,
				"지원하지 않는 녹음 형식입니다. WebM, MP3, MP4, WAV, OGG 파일을 사용해 주세요.",
			);
		}
		const result = await client().audio.transcriptions.create(
			{
				model: "gpt-4o-mini-transcribe",
				file,
				language: "ko",
			},
			{ signal: signal(request) },
		);
		if (!result.text.trim())
			throw new HttpError(
				422,
				"말소리를 인식하지 못했습니다. 다시 녹음하거나 직접 입력해 주세요.",
			);
		return Response.json(
			{ text: result.text.trim() },
			{ headers: { "Cache-Control": "no-store" } },
		);
	});
}
