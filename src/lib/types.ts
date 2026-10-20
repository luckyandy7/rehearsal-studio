import { z } from "zod";
import {
	emptyInterviewContext,
	interviewContextSchema,
	questionSourceSchema,
} from "./interview-context";
import { voiceAnalysisSchema } from "./voice-analysis";

export const modeSchema = z.enum(["interview", "presentation"]);
export type Mode = z.infer<typeof modeSchema>;
export const configSchema = z.object({
	mode: modeSchema,
	interviewContext: interviewContextSchema.default(emptyInterviewContext),
	material: z.string().min(20).max(30000),
	role: z.string().min(1).max(160),
	difficulty: z.enum(["gentle", "normal", "pressure"]),
	durationMinutes: z.number().int().min(1).max(30),
	provider: z.enum(["openai", "demo"]),
	fileName: z.string().max(255),
});
export type SessionConfig = z.infer<typeof configSchema>;
export const messageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().max(12000),
	sources: z.array(questionSourceSchema).max(3).optional(),
});
export type Message = z.infer<typeof messageSchema>;
export const reportSchema = z.object({
	summary: z.string(),
	strengths: z.array(z.string()),
	improvements: z.array(z.string()),
	exercises: z.array(z.string()),
	evidence: z.array(z.object({ quote: z.string(), feedback: z.string() })),
});
export type Report = z.infer<typeof reportSchema>;
export const recordSchema = z.object({
	id: z.string(),
	createdAt: z.string(),
	config: configSchema,
	messages: z.array(messageSchema),
	report: reportSchema,
	elapsedSeconds: z.number(),
	voiceAnalysis: voiceAnalysisSchema.optional(),
});
export type PracticeRecord = z.infer<typeof recordSchema>;
export const modeLabels: Record<Mode, string> = {
	interview: "면접 연습",
	presentation: "발표 연습",
};
