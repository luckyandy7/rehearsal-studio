import { z } from "zod";

export type VoiceStatus =
	| "idle"
	| "connecting"
	| "listening"
	| "speaking"
	| "paused"
	| "error";
export const realtimeEventSchema = z.object({
	type: z.string(),
	transcript: z.string().optional(),
	item_id: z.string().optional(),
	error: z.object({ code: z.string().optional() }).optional(),
	response: z.object({ status: z.string() }).optional(),
});

// Mutable resource ownership: one connection owns all browser handles.
export type VoiceConnection = {
	controller: AbortController;
	peer: RTCPeerConnection;
	channel: RTCDataChannel;
	audio: HTMLAudioElement;
	stream: MediaStream | null;
	context: AudioContext | null;
	meter: ReturnType<typeof setInterval> | null;
	deadline: ReturnType<typeof setTimeout> | null;
	responding: boolean;
	playing: boolean;
	muted: boolean;
};
