import OpenAI from "openai";
import { z } from "zod";

export class HttpError extends Error {
	readonly name = "HttpError";
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

// Per-process cap for the local contest prototype, not a distributed quota.
const quota = { started: Date.now(), used: 0 };

export function guard(request: Request): void {
	const origin = request.headers.get("origin");
	if (origin && origin !== new URL(request.url).origin) {
		throw new HttpError(403, "이 앱에서 보낸 요청만 처리할 수 있습니다.");
	}
	if (request.headers.get("sec-fetch-site") === "cross-site") {
		throw new HttpError(403, "외부 사이트의 요청은 허용되지 않습니다.");
	}
	if (Date.now() - quota.started > 60_000) {
		quota.started = Date.now();
		quota.used = 0;
	}
	quota.used += 1;
	if (quota.used > 90)
		throw new HttpError(429, "요청이 많습니다. 1분 뒤 다시 시도해 주세요.");
}

export async function limitedBody(
	request: Request,
	limit: number,
): Promise<ArrayBuffer> {
	if (Number(request.headers.get("content-length")) > limit)
		throw new HttpError(413, "파일 또는 요청 크기가 너무 큽니다.");
	const reader = request.body?.getReader();
	if (!reader) throw new HttpError(400, "요청 내용이 비어 있습니다.");
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			request.signal.throwIfAborted();
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > limit) {
				await reader.cancel();
				throw new HttpError(413, "파일 또는 요청 크기가 너무 큽니다.");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const result = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result.buffer;
}

export async function jsonBody<T>(
	request: Request,
	schema: z.ZodType<T>,
): Promise<T> {
	const raw = await limitedBody(request, 512_000);
	return schema.parse(JSON.parse(new TextDecoder().decode(raw)));
}

export async function upload(
	request: Request,
	field: string,
	maximum: number,
): Promise<File> {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.startsWith("multipart/form-data;"))
		throw new HttpError(400, "파일 업로드 형식이 올바르지 않습니다.");
	const raw = await limitedBody(request, maximum + 64_000);
	const form = await new Response(raw, {
		headers: { "content-type": contentType },
	}).formData();
	const file = form.get(field);
	if (!(file instanceof File) || !file.size)
		throw new HttpError(400, "업로드할 파일을 선택해 주세요.");
	if (file.size > maximum)
		throw new HttpError(413, "업로드 용량 제한을 초과했습니다.");
	return file;
}

export function failure(error: unknown): Response {
	let status = 500;
	let message = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
	if (error instanceof HttpError) {
		status = error.status;
		message = error.message;
	} else if (
		error instanceof z.ZodError ||
		error instanceof SyntaxError ||
		error instanceof TypeError
	) {
		status = 400;
		message = "입력 형식이나 길이를 확인해 주세요.";
	} else if (error instanceof OpenAI.APIError) {
		status = error.status === 429 ? 429 : 502;
		message =
			error.status === 429
				? "OpenAI 사용 한도 또는 잔액을 확인해 주세요. 잠시 후 다시 시도할 수 있습니다."
				: "OpenAI 연결에 실패했습니다. 서버의 키와 모델 설정을 확인해 주세요.";
	} else if (
		error instanceof Error &&
		(error.name.includes("Abort") || error.name.includes("Timeout"))
	) {
		status = 408;
		message = "요청이 중단되었거나 응답 시간이 초과되었습니다.";
	}
	return Response.json(
		{ error: message },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}

export async function endpoint(
	request: Request,
	work: () => Promise<Response>,
): Promise<Response> {
	try {
		guard(request);
		return await work();
	} catch (error) {
		return failure(error);
	}
}

export function signal(request: Request): AbortSignal {
	return AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
}
