# Backend sources

Verified 2026-10-20 against official documentation via Context7 and OpenAI pages.

- https://developers.openai.com/api/docs/models/gpt-6-luna.md — question default; OPENAI_MODEL override.
- https://developers.openai.com/api/docs/guides/latest-model.md — GPT-6.1 Sol report default; OPENAI_REPORT_MODEL override.
- https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini.md — Realtime default; OPENAI_REALTIME_MODEL override.
- https://developers.openai.com/api/docs/guides/structured-outputs — Responses parse and zodTextFormat for feedback.
- https://developers.openai.com/api/docs/guides/text-to-speech — gpt-4o-mini-tts, MP3 and marin voice.
- https://developers.openai.com/api/docs/guides/speech-to-text — gpt-4o-mini-transcribe.
- https://github.com/mehmet-kozan/pdf-parse/blob/main/README.md — PDFParse getInfo, getText, destroy.
- https://github.com/mehmet-kozan/pdf-parse/blob/main/docs/troubleshooting.md — Next.js serverExternalPackages configuration.

The local app sends document text and conversation to OpenAI only when an AI session is requested. Extracting uploaded documents happens locally in the server process. Responses requests use store:false. No uploads or audio are written to disk by these endpoints. OpenAI provider retention policies still apply.

POST /api/realtime establishes OpenAI Realtime WebRTC through the unified server interface. The API key stays on the server. Interview mode uses server VAD automatic responses; presentation mode emits VAD/transcription events but waits for client response.create requests. The recorded-audio endpoints are also available. The HTTP request timeout is 60 seconds; uploaded documents are limited to 10 MiB, audio to 15 MiB, extracted text to 30,000 characters, PDF to 80 pages. Office ZIP entries are bounded before decompression; files never extract to filesystem paths. Scanned PDF OCR is not implemented.

- https://developers.openai.com/api/docs/guides/realtime-webrtc — unified multipart SDP connection.
- https://developers.openai.com/api/docs/api-reference/realtime/create-call — nested audio input/transcription and server_vad create_response/interrupt_response fields.

Per-process rate cap and browser same-origin checks are local prototype safeguards, not authentication. Bind to localhost for local use. Add authentication and durable per-user quotas before exposing publicly.

URL import uses Node HTTP(S), a validated and pinned public DNS address per redirect, a 12-second deadline, a 2 MB response cap, and Cheerio text extraction. It does not run page JavaScript or bypass authentication. Voice coaching uses local Web Audio RMS and autocorrelation estimates; it is not an emotion classifier. Only aggregate metrics are persisted and optionally sent to the report API.
