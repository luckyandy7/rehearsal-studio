import { configured } from "@/lib/server/ai";
export const runtime = "nodejs";
export async function GET(): Promise<Response> {
	return Response.json(
		{ configured: configured() },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
