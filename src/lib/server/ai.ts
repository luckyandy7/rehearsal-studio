import OpenAI from "openai";
import { HttpError } from "./http";

export function configured(): boolean {
	return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function client(): OpenAI {
	if (!configured())
		throw new HttpError(503, "OpenAI API 키가 아직 설정되지 않았습니다.");
	return new OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
		timeout: 55_000,
		maxRetries: 0,
	});
}

export function textModel(): string {
	return process.env.OPENAI_MODEL || "gpt-6-luna";
}

export function reportModel(): string {
	return process.env.OPENAI_REPORT_MODEL || "gpt-6.1-sol";
}

export function realtimeModel(): string {
	return process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
}
