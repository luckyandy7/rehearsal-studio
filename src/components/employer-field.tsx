"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { api, errorMessage } from "@/lib/api";
import type { InterviewContext } from "@/lib/interview-context";
import { Button } from "./ui";
export type EmployerFieldDefinition = {
	readonly key: "jobPosting" | "companyInfo" | "companyValues";
	readonly label: string;
	readonly limit: number;
	readonly placeholder: string;
};
const resultSchema = z.object({
	text: z.string(),
	url: z.string().url(),
	title: z.string(),
	truncated: z.boolean(),
});
export function EmployerField({
	field,
	value,
	sourceUrl,
	disabled,
	onPending,
	onChange,
}: {
	readonly field: EmployerFieldDefinition;
	readonly value: string;
	readonly sourceUrl: string | undefined;
	readonly disabled: boolean;
	readonly onPending: (pending: boolean) => void;
	readonly onChange: (text: string, url?: string) => void;
}) {
	const [url, setUrl] = useState(sourceUrl ?? "");
	const [manual, setManual] = useState(false);
	const [fetching, setFetching] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const controller = useRef<AbortController | null>(null);
	useEffect(() => () => controller.current?.abort(), []);
	const fetchContent = async () => {
		if (!url.trim()) {
			setError("가져올 URL을 입력해 주세요.");
			return;
		}
		controller.current?.abort();
		const current = new AbortController();
		controller.current = current;
		setFetching(true);
		onPending(true);
		setError("");
		setNotice("");
		try {
			const result = resultSchema.parse(
				await api
					.post("/api/import-url", {
						json: { url: url.trim(), kind: field.key },
						signal: current.signal,
						timeout: 15000,
					})
					.json<unknown>(),
			);
			if (controller.current !== current) return;
			onChange(result.text, result.url);
			setUrl(result.url);
			setNotice(
				`${result.title || "페이지"}에서 가져왔어요.${result.truncated ? ` ${field.limit.toLocaleString()}자까지만 가져왔으니 필요한 내용을 확인해 주세요.` : " 내용을 확인하고 필요하면 수정해 주세요."}`,
			);
		} catch (cause) {
			if (!current.signal.aborted) setError(await errorMessage(cause));
		} finally {
			if (controller.current === current) {
				setFetching(false);
				onPending(false);
			}
		}
	};
	return (
		<div className="employer-field">
			<label
				className="field-label"
				htmlFor={manual ? field.key : `${field.key}-url`}
			>
				{field.label}
			</label>
			{!manual && (
				<div className="url-controls">
					<input
						id={`${field.key}-url`}
						type="url"
						placeholder="https://기업-채용페이지…"
						value={url}
						disabled={disabled || fetching}
						onChange={(event) => setUrl(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								void fetchContent();
							}
						}}
						aria-describedby={`${field.key}-import-status`}
					/>
					<Button
						type="button"
						variant="secondary"
						busy={fetching}
						disabled={disabled}
						onClick={() => void fetchContent()}
					>
						URL 가져오기
					</Button>
				</div>
			)}
			<div id={`${field.key}-import-status`} aria-live="polite">
				{error && (
					<p className="screen-error">{error} 기존 내용은 유지됩니다.</p>
				)}
				{notice && <p className="connection-note">{notice}</p>}
			</div>
			<Button
				type="button"
				variant="ghost"
				disabled={disabled || fetching}
				onClick={() => {
					setManual(!manual);
					setError("");
				}}
			>
				{manual ? "URL로 가져오기" : "수동 입력"}
			</Button>
			{(manual || Boolean(value)) && (
				<div>
					<label className="field-label" htmlFor={field.key}>
						{manual ? "내용 직접 입력" : "가져온 내용 확인·수정"}
					</label>
					<textarea
						id={field.key}
						rows={4}
						maxLength={field.limit}
						value={value}
						disabled={disabled || fetching}
						placeholder={field.placeholder}
						onChange={(event) => onChange(event.target.value, sourceUrl)}
						aria-describedby={`${field.key}-count`}
					/>
					<small id={`${field.key}-count`} className="context-count">
						{value.length.toLocaleString()} / {field.limit.toLocaleString()}
					</small>
					{sourceUrl && (
						<p className="context-hint">
							참고 URL:{" "}
							<a href={sourceUrl} target="_blank" rel="noopener noreferrer">
								수집 페이지 열기
							</a>{" "}
							· 수정한 내용이 질문에 사용됩니다.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
export type EmployerUpdate = (previous: InterviewContext) => InterviewContext;
