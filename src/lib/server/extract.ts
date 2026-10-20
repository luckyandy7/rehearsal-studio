import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import { HttpError } from "./http";

function officeEntries(
	data: Uint8Array,
	extractSlides: boolean,
): Record<string, Uint8Array> {
	let bytes = 0;
	let entries = 0;
	return unzipSync(data, {
		filter: (entry) => {
			bytes += entry.originalSize;
			entries += 1;
			if (
				bytes > 30_000_000 ||
				entries > 2_000 ||
				entry.originalSize > 10_000_000
			) {
				throw new HttpError(
					413,
					"압축을 푼 문서가 너무 큽니다. 문서를 나누어 올려 주세요.",
				);
			}
			return extractSlides && /^ppt\/slides\/slide\d+\.xml$/.test(entry.name);
		},
	});
}

function xmlText(xml: string): string {
	return Array.from(
		xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g),
		(match) => match[1] ?? "",
	)
		.join(" ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
			const point = code.startsWith("x")
				? Number.parseInt(code.slice(1), 16)
				: Number(code);
			return point <= 0x10ffff ? String.fromCodePoint(point) : "";
		})
		.replace(/&amp;/g, "&");
}

export async function extractText(file: File): Promise<string> {
	const extension = file.name.split(".").pop()?.toLowerCase();
	const bytes = new Uint8Array(await file.arrayBuffer());
	let text: string;
	try {
		switch (extension) {
			case "txt":
				text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
				break;
			case "docx": {
				officeEntries(bytes, false);
				text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) }))
					.value;
				break;
			}
			case "pptx": {
				const slides = officeEntries(bytes, true);
				text = Object.keys(slides)
					.sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
					.map(
						(name, index) =>
							`슬라이드 ${index + 1}\n${xmlText(strFromU8(slides[name] ?? new Uint8Array()))}`,
					)
					.join("\n\n");
				break;
			}
			case "pdf": {
				const { PDFParse } = await import("pdf-parse");
				const parser = new PDFParse({ data: bytes, isEvalSupported: false });
				try {
					const info = await parser.getInfo();
					if (info.total > 80)
						throw new HttpError(413, "PDF는 80쪽 이하로 나누어 올려 주세요.");
					text = (await parser.getText()).text;
				} finally {
					await parser.destroy();
				}
				break;
			}
			default:
				throw new HttpError(
					415,
					"PDF, DOCX, PPTX, UTF-8 TXT 파일만 지원합니다.",
				);
		}
	} catch (error) {
		if (error instanceof HttpError) throw error;
		throw new HttpError(
			422,
			"문서 내용을 읽을 수 없습니다. 암호를 해제하거나 텍스트 파일로 다시 올려 주세요.",
		);
	}
	text = text.replaceAll("\u0000", "").trim();
	if (!text)
		throw new HttpError(
			422,
			"추출할 텍스트가 없습니다. 스캔 문서는 텍스트를 직접 붙여 넣어 주세요.",
		);
	if (text.length > 30_000)
		throw new HttpError(413, "문서는 텍스트 30,000자 이하로 줄여 주세요.");
	return text;
}
