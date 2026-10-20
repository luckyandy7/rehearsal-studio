import ky, { HTTPError } from "ky";
import { z } from "zod";
export const api = ky.create({ timeout: 90000, retry: 0 });
export async function errorMessage(error: unknown): Promise<string> {
	if (error instanceof HTTPError) {
		const body: unknown = error.data;
		const parsed = z.object({ error: z.string() }).safeParse(body);
		return parsed.success
			? parsed.data.error
			: `요청을 완료하지 못했습니다 (${error.response.status}). 다시 시도해 주세요.`;
	}
	if (error instanceof Error && error.name === "AbortError")
		return "요청이 취소되었습니다.";
	if (error instanceof Error) return "연결을 확인하고 다시 시도해 주세요.";
	return "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}
