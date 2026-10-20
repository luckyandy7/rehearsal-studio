import { z } from "zod";
import { endpoint, jsonBody } from "@/lib/server/http";
import { importUrl } from "@/lib/server/import-url";
export const runtime = "nodejs";
const schema = z.object({
	url: z.string().trim().min(1).max(2048),
	kind: z.enum(["jobPosting", "companyInfo", "companyValues"]),
});
export async function POST(request: Request): Promise<Response> {
	return endpoint(request, async () => {
		const input = await jsonBody(request, schema);
		return Response.json(
			await importUrl(
				input.url,
				input.kind === "jobPosting" ? 8000 : 4000,
				request.signal,
			),
			{ headers: { "Cache-Control": "no-store" } },
		);
	});
}
