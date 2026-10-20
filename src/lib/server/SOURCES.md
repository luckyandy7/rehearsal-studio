# Backend sources

Verified 2026-10-20 against official documentation via Context7 and OpenAI pages.

- https://developers.openai.com/api/docs/models/gpt-4.1-mini — inexpensive text default; can override with OPENAI_MODEL.
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
