import { z } from "zod";
import { type PracticeRecord, recordSchema } from "./types";

const KEY = "rehearsal-records-v1";
export function readRecords(): PracticeRecord[] {
	const raw = localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed = z.array(recordSchema).safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : [];
	} catch (error) {
		if (error instanceof SyntaxError) return [];
		throw error;
	}
}
export function writeRecords(records: readonly PracticeRecord[]): void {
	localStorage.setItem(KEY, JSON.stringify(records.slice(0, 30)));
}
export function exportRecord(record: PracticeRecord): void {
	const text = `# ${record.config.role} · ${record.config.mode === "interview" ? "면접" : "발표"} 리포트\n\n${record.report.summary}\n\n## 잘한 점\n${record.report.strengths.map((x) => `- ${x}`).join("\n")}\n\n## 개선할 점\n${record.report.improvements.map((x) => `- ${x}`).join("\n")}\n\n## 다음 연습\n${record.report.exercises.map((x) => `- ${x}`).join("\n")}\n\n## 발언 근거\n${record.report.evidence.map((x) => `> ${x.quote}\n\n${x.feedback}`).join("\n\n")}\n\n## 대화 기록\n${record.messages.map((m) => `**${m.role === "user" ? "나" : "AI"}**: ${m.content}`).join("\n\n")}`;
	const url = URL.createObjectURL(
		new Blob([text], { type: "text/markdown;charset=utf-8" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = `rehearsal-${record.id}.md`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
