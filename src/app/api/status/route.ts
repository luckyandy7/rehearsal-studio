import {
	configured,
	realtimeModel,
	reportModel,
	textModel,
} from "@/lib/server/ai";
export const runtime = "nodejs";
export async function GET(): Promise<Response> {
	return Response.json(
		{
			configured: configured(),
			models: {
				question: textModel(),
				report: reportModel(),
				realtime: realtimeModel(),
			},
		},
		{ headers: { "Cache-Control": "no-store" } },
	);
}
