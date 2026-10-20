"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { api, errorMessage } from "@/lib/api";
import type { Message, SessionConfig } from "@/lib/types";
import {
	realtimeEventSchema,
	type VoiceConnection,
	type VoiceStatus,
} from "./realtime-types";

export function useRealtime({
	config,
	onMessage,
	onStream,
	onStreamEnd,
}: {
	readonly config: SessionConfig;
	readonly onMessage: (message: Message) => void;
	readonly onStream: (stream: MediaStream) => void;
	readonly onStreamEnd: () => void;
}) {
	const [status, setStatus] = useState<VoiceStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [muted, setMuted] = useState(false);
	const [level, setLevel] = useState(0);
	const connection = useRef<VoiceConnection | null>(null);
	const callback = useRef(onMessage);
	const streamCallback = useRef(onStream);
	const streamEndCallback = useRef(onStreamEnd);
	useEffect(() => {
		streamEndCallback.current = onStreamEnd;
	}, [onStreamEnd]);
	useEffect(() => {
		streamCallback.current = onStream;
	}, [onStream]);
	useEffect(() => {
		callback.current = onMessage;
	}, [onMessage]);

	const release = useCallback(() => {
		const current = connection.current;
		connection.current = null;
		if (!current) return;
		streamEndCallback.current();
		current.controller.abort();
		if (current.deadline) clearTimeout(current.deadline);
		if (current.meter) clearInterval(current.meter);
		current.stream?.getTracks().forEach((track) => {
			track.stop();
		});
		current.channel.close();
		current.peer.close();
		current.audio.pause();
		current.audio.srcObject = null;
		if (current.context && current.context.state !== "closed") {
			void current.context.close().catch((cause: unknown) => {
				if (cause instanceof DOMException && cause.name === "InvalidStateError")
					return;
				setError(
					"오디오 장치를 정리하지 못했습니다. 페이지를 새로고침해 주세요.",
				);
			});
		}
	}, []);
	const disconnect = useCallback(() => {
		release();
		setStatus("idle");
		setMuted(false);
		setLevel(0);
	}, [release]);
	useEffect(() => release, [release]);

	const fail = useCallback(
		(message: string) => {
			release();
			setError(message);
			setStatus("error");
			setLevel(0);
			setMuted(false);
		},
		[release],
	);

	const send = useCallback((event: object) => {
		const current = connection.current;
		if (!current || current.channel.readyState !== "open") return false;
		current.channel.send(JSON.stringify(event));
		return true;
	}, []);
	const interrupt = useCallback(() => {
		const current = connection.current;
		if (!current) return;
		if (current.responding) send({ type: "response.cancel" });
		if (current.playing) send({ type: "output_audio_buffer.clear" });
		current.responding = false;
		current.playing = false;
		setStatus(current.muted ? "paused" : "listening");
	}, [send]);
	const askQuestion = useCallback(() => {
		const current = connection.current;
		if (!current || current.muted || current.responding || current.playing)
			return;
		// Keep the session instructions, including employer and resume context.
		if (send({ type: "response.create" })) current.responding = true;
	}, [send]);
	const toggleMute = useCallback(() => {
		const current = connection.current;
		if (!current?.stream) return;
		current.muted = !current.muted;
		current.stream.getAudioTracks().forEach((track) => {
			track.enabled = !current.muted;
		});
		setMuted(current.muted);
		if (current.muted) interrupt();
		setStatus(current.muted ? "paused" : "listening");
	}, [interrupt]);

	const connect = useCallback(async () => {
		if (connection.current) return;
		setError(null);
		setStatus("connecting");
		setMuted(false);
		if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
			fail(
				"이 브라우저에서는 음성 연결을 사용할 수 없습니다. HTTPS 또는 localhost에서 Chrome으로 열어 주세요.",
			);
			return;
		}
		const peer = new RTCPeerConnection();
		const channel = peer.createDataChannel("oai-events");
		const current: VoiceConnection = {
			controller: new AbortController(),
			peer,
			channel,
			audio: new Audio(),
			stream: null,
			context: null,
			meter: null,
			deadline: null,
			responding: false,
			playing: false,
			muted: false,
		};
		connection.current = current;
		current.audio.autoplay = true;
		const live = () => connection.current === current;
		const ready = () => setStatus(current.muted ? "paused" : "listening");
		const seen = new Set<string>();
		channel.onmessage = (event: MessageEvent<unknown>) => {
			if (!live() || typeof event.data !== "string") return;
			let raw: unknown;
			try {
				raw = JSON.parse(event.data);
			} catch (cause) {
				if (cause instanceof SyntaxError) {
					fail("음성 서버의 응답을 읽지 못했습니다. 다시 연결해 주세요.");
					return;
				}
				throw cause;
			}
			const parsed = realtimeEventSchema.safeParse(raw);
			if (!parsed.success) return;
			const message = parsed.data;
			switch (message.type) {
				case "conversation.item.input_audio_transcription.completed":
				case "response.output_audio_transcript.done": {
					const key = `${message.type}:${message.item_id}`;
					if (!message.transcript?.trim() || seen.has(key)) return;
					if (message.item_id) seen.add(key);
					callback.current({
						role: message.type.startsWith("conversation.")
							? "user"
							: "assistant",
						content: message.transcript,
					});
					return;
				}
				case "response.created":
					current.responding = true;
					return;
				case "output_audio_buffer.started":
					current.playing = true;
					setStatus("speaking");
					return;
				case "output_audio_buffer.stopped":
				case "output_audio_buffer.cleared":
					current.playing = false;
					ready();
					return;
				case "response.done":
					current.responding = false;
					if (message.response?.status === "failed") {
						fail(
							"AI 음성 응답이 실패했습니다. 사용 한도와 연결 상태를 확인해 주세요.",
						);
						return;
					}
					if (!current.playing) ready();
					return;
				case "conversation.item.input_audio_transcription.failed":
					setError("방금 답변의 자막을 만들지 못했습니다. 다시 말해 주세요.");
					return;
				case "error":
					if (message.error?.code === "response_cancel_not_active") return;
					fail("음성 세션에서 오류가 발생했습니다. 다시 연결해 주세요.");
					return;
				default:
					return; // Other server events do not change the voice UI.
			}
		};
		channel.onopen = () => {
			if (!live()) return;
			if (current.deadline) clearTimeout(current.deadline);
			ready();
			send({ type: "response.create" });
			current.responding = true;
		};
		channel.onclose = () => {
			if (live()) fail("음성 연결이 종료되었습니다. 다시 연결해 주세요.");
		};
		channel.onerror = () => {
			if (live()) fail("음성 데이터 연결에 실패했습니다. 다시 연결해 주세요.");
		};
		peer.onconnectionstatechange = () => {
			if (
				live() &&
				["failed", "disconnected", "closed"].includes(peer.connectionState)
			)
				fail(
					"음성 연결이 끊어졌습니다. 인터넷을 확인한 뒤 다시 연결해 주세요.",
				);
		};
		peer.ontrack = (event) => {
			if (!live()) return;
			current.audio.srcObject =
				event.streams[0] ?? new MediaStream([event.track]);
			void current.audio.play().catch((cause: unknown) => {
				if (live() && cause instanceof Error)
					fail(
						"음성 재생이 차단되었습니다. 브라우저의 소리 재생을 허용한 뒤 다시 연결해 주세요.",
					);
			});
		};
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
			if (!live()) {
				stream.getTracks().forEach((track) => {
					track.stop();
				});
				return;
			}
			current.stream = stream;
			streamCallback.current(stream);
			for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
			const context = new AudioContext();
			current.context = context;
			const analyser = context.createAnalyser();
			analyser.fftSize = 256;
			context.createMediaStreamSource(stream).connect(analyser);
			const samples = new Uint8Array(analyser.fftSize);
			current.meter = setInterval(() => {
				analyser.getByteTimeDomainData(samples);
				const energy = samples.reduce(
					(sum, sample) => sum + ((sample - 128) / 128) ** 2,
					0,
				);
				setLevel(
					current.muted
						? 0
						: Math.min(1, Math.sqrt(energy / samples.length) * 4),
				);
			}, 100);
			current.deadline = setTimeout(() => {
				if (live())
					fail(
						"음성 연결 시간이 초과되었습니다. 네트워크를 확인하고 다시 시도해 주세요.",
					);
			}, 90000);
			const offer = await peer.createOffer();
			if (!live()) return;
			await peer.setLocalDescription(offer);
			if (!live()) return;
			const data = await api
				.post("/api/realtime", {
					json: { sdp: offer.sdp, config },
					signal: current.controller.signal,
				})
				.json<unknown>();
			if (!live()) return;
			const answer = z.object({ sdp: z.string().min(1) }).parse(data);
			await peer.setRemoteDescription({ type: "answer", sdp: answer.sdp });
		} catch (cause) {
			if (!live()) return;
			if (cause instanceof DOMException && cause.name === "NotAllowedError") {
				fail(
					"마이크 권한이 필요합니다. 브라우저 주소창의 사이트 설정에서 마이크를 허용해 주세요.",
				);
				return;
			}
			if (cause instanceof DOMException && cause.name === "NotFoundError") {
				fail(
					"마이크를 찾지 못했습니다. 마이크를 연결한 뒤 다시 시도해 주세요.",
				);
				return;
			}
			const message = await errorMessage(cause);
			if (live()) fail(message);
		}
	}, [config, fail, send]);

	return {
		status,
		error,
		connect,
		disconnect,
		toggleMute,
		muted,
		askQuestion,
		interrupt,
		level,
	};
}
