import { extractText } from "@/lib/server/extract";
import { endpoint, upload } from "@/lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
	return endpoint(request, async () => {
		const file = await upload(request, "file", 10 * 1024 * 1024);
		const text = await extractText(file);
		return Response.json(
			{ text, name: file.name },
			{ headers: { "Cache-Control": "no-store" } },
		);
	});
}
