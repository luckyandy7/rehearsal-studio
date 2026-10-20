import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { load } from "cheerio";
import ipaddr from "ipaddr.js";
import { HttpError } from "./http";

export function publicAddress(address: string): boolean {
	if (!ipaddr.isValid(address)) return false;
	return ipaddr.process(address).range() === "unicast";
}
export function publicUrl(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new HttpError(400, "올바른 http 또는 https URL을 입력해 주세요.");
	}
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (
		!["http:", "https:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.port ||
		/(^|\.)(localhost|local|internal|lan|home|test)$/.test(host) ||
		(!host.includes(".") && !isIP(host))
	)
		throw new HttpError(
			400,
			"공개 웹사이트의 기본 포트 URL만 가져올 수 있습니다.",
		);
	if (isIP(host) && !publicAddress(host))
		throw new HttpError(400, "내부 네트워크 주소는 가져올 수 없습니다.");
	url.hash = "";
	return url;
}
async function fetchPage(
	url: URL,
	signal: AbortSignal,
): Promise<{ body: string; location: string | null }> {
	const host = url.hostname.replace(/^\[|\]$/g, "");
	signal.throwIfAborted();
	const addresses = isIP(host)
		? [{ address: host, family: isIP(host) }]
		: await new Promise<LookupAddress[]>((resolve, reject) => {
				const abort = () => reject(signal.reason);
				signal.addEventListener("abort", abort, { once: true });
				void lookup(host, { all: true, verbatim: true })
					.then(resolve, reject)
					.finally(() => signal.removeEventListener("abort", abort));
			});
	signal.throwIfAborted();
	if (
		!addresses.length ||
		addresses.some((item) => !publicAddress(item.address))
	)
		throw new HttpError(
			400,
			"공개 인터넷 주소로 확인되지 않아 가져오지 않았습니다.",
		);
	const address = addresses[0];
	if (!address) throw new HttpError(400, "주소를 확인하지 못했습니다.");
	return new Promise((resolve, reject) => {
		const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
			url,
			{
				signal,
				headers: {
					"User-Agent": "RehearsalStudio/0.1 (user-requested page import)",
					Accept: "text/html,text/plain",
					"Accept-Encoding": "identity",
				},
				// Pin the validated DNS answer; keep the URL hostname for TLS and Host.
				lookup: (_hostname, options, callback) => {
					if (options.all) callback(null, [address]);
					else callback(null, address.address, address.family);
				},
			},
			(response) => {
				const code = response.statusCode ?? 502;
				if ([301, 302, 303, 307, 308].includes(code)) {
					response.resume();
					resolve({ body: "", location: response.headers.location ?? null });
					return;
				}
				if (code < 200 || code >= 300) {
					response.resume();
					reject(
						new HttpError(
							422,
							"사이트가 접근을 허용하지 않았습니다. 수동 입력으로 이어가 주세요.",
						),
					);
					return;
				}
				const contentType = response.headers["content-type"] ?? "";
				if (
					!/text\/(html|plain)|application\/xhtml\+xml/i.test(contentType) ||
					!["identity", undefined].includes(
						response.headers["content-encoding"],
					)
				) {
					response.resume();
					reject(
						new HttpError(
							415,
							"이 링크의 문서 형식은 자동으로 읽을 수 없습니다. 수동 입력을 사용해 주세요.",
						),
					);
					return;
				}
				const chunks: Buffer[] = [];
				let size = 0;
				response.on("data", (chunk: Buffer) => {
					size += chunk.length;
					if (size > 2_000_000) {
						response.destroy(
							new HttpError(
								413,
								"페이지가 너무 큽니다. 필요한 내용을 수동 입력해 주세요.",
							),
						);
						return;
					}
					chunks.push(chunk);
				});
				response.on("error", reject);
				response.on("end", () => {
					try {
						const bytes = Buffer.concat(chunks);
						const charset =
							contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ??
							bytes
								.subarray(0, 2048)
								.toString("ascii")
								.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] ??
							"utf-8";
						resolve({
							body: new TextDecoder(charset).decode(bytes),
							location: null,
						});
					} catch {
						reject(
							new HttpError(
								422,
								"페이지의 글자를 읽지 못했습니다. 수동 입력을 사용해 주세요.",
							),
						);
					}
				});
			},
		);
		request.on("error", reject);
		request.end();
	});
}
export function pageText(html: string): { title: string; text: string } {
	const $ = load(html);
	const title = $("title").first().text().trim().slice(0, 200);
	$(
		'script,style,noscript,svg,nav,header,footer,form,iframe,[hidden],[aria-hidden="true"]',
	).remove();
	const main = $(
		'main,article,[role="main"],#content,#contents,.job-description',
	).first();
	const content = main.length ? main : $("body");
	content.find("br").replaceWith("\n");
	content.find("p,div,li,h1,h2,h3,h4,section,tr").append("\n");
	const text = content
		.text()
		.replace(/[\t \u00a0]+/g, " ")
		.replace(/\n\s*\n/g, "\n")
		.trim();
	if (
		text.length < 100 ||
		/just a moment|access denied|verify you are human|checking your browser/i.test(
			title,
		)
	)
		throw new HttpError(
			422,
			"읽을 수 있는 본문을 찾지 못했습니다. 로그인·차단·동적 페이지라면 수동 입력해 주세요.",
		);
	return { title, text };
}
export async function importUrl(
	raw: string,
	limit: number,
	parentSignal: AbortSignal,
) {
	const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(12000)]);
	let url = publicUrl(raw);
	try {
		for (let redirects = 0; redirects <= 3; redirects++) {
			const page = await fetchPage(url, signal);
			if (page.location) {
				url = publicUrl(new URL(page.location, url).href);
				continue;
			}
			const extracted = pageText(page.body);
			return {
				title: extracted.title,
				text: extracted.text.slice(0, limit),
				url: url.href,
				truncated: extracted.text.length > limit,
			};
		}
		throw new HttpError(
			422,
			"페이지 이동이 너무 많습니다. 최종 페이지 URL이나 수동 입력을 사용해 주세요.",
		);
	} catch (error) {
		if (error instanceof HttpError) throw error;
		throw new HttpError(
			422,
			"URL을 가져오지 못했습니다. 주소를 확인하거나 수동 입력을 사용해 주세요.",
		);
	}
}
