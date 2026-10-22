const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { setup } = require("./camera-fixtures.cjs");
function rtc() {
	window.__sent = [];
	window.__offset = 0;
	const now = Date.now;
	Date.now = () => now() + window.__offset;
	window.RTCPeerConnection = class {
		createDataChannel() {
			this.channel = {
				readyState: "open",
				send(data) {
					window.__sent.push(JSON.parse(data));
				},
				close() {
					this.readyState = "closed";
				},
			};
			window.__emit = (data) =>
				this.channel.onmessage?.({ data: JSON.stringify(data) });
			return this.channel;
		}
		addTrack() {}
		async createOffer() {
			return { type: "offer", sdp: "v=0\r\n" };
		}
		async setLocalDescription() {}
		async setRemoteDescription() {
			this.channel.onopen?.();
		}
		close() {}
	};
}
(async () => {
	const browser = await chromium.launch({
		channel: "chrome",
		headless: true,
		args: [
			"--use-fake-device-for-media-stream",
			"--use-fake-ui-for-media-stream",
		],
	});
	try {
		const page = await browser.newPage();
		await page.addInitScript(rtc);
		const requests = [],
			errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.route("**/api/realtime", (route) => {
			requests.push(route.request().postDataJSON());
			return route.fulfill({ json: { sdp: "v=0\r\n" } });
		});
		await setup(page, "발표");
		await page
			.getByRole("button", { name: "확인했어요 · 발표방 입장" })
			.click();
		await page
			.getByRole("button", { name: "실시간 음성 연결", exact: true })
			.click();
		await page.getByText("답변을 듣고 있어요", { exact: true }).waitFor();
		const emit = (data) => page.evaluate((e) => window.__emit(e), data);
		const count = () =>
			page.evaluate(
				() => window.__sent.filter((e) => e.type === "response.create").length,
			);
		await emit({ type: "response.done", response: { status: "completed" } });
		await emit({
			type: "response.output_audio_transcript.done",
			item_id: "a1",
			transcript: "발표를 시작하세요.",
		});
		await emit({ type: "input_audio_buffer.speech_started" });
		await page.waitForTimeout(1100);
		await emit({
			type: "conversation.item.input_audio_transcription.completed",
			item_id: "u1",
			transcript: "저희 서비스는 기존 서비스보다 정확합니다.",
		});
		await page.evaluate(() => (window.__offset += 80000));
		await page.waitForTimeout(1500);
		assert.equal(await count(), 1, "must wait for speech stop");
		await emit({ type: "input_audio_buffer.speech_stopped" });
		await page.waitForTimeout(1600);
		assert.equal(await count(), 2, "claim must trigger after silence");
		await emit({
			type: "response.output_audio_transcript.done",
			item_id: "a2",
			transcript: "어떤 기준과 조건으로 비교했나요?",
		});
		await emit({ type: "response.done", response: { status: "completed" } });
		await page.getByText(/반박 근거:/).waitFor();
		await emit({
			type: "conversation.item.input_audio_transcription.completed",
			item_id: "u2",
			transcript: "저희 서비스는 기존 서비스보다 정확합니다.",
		});
		await page.evaluate(() => (window.__offset += 80000));
		await page.waitForTimeout(1500);
		assert.equal(await count(), 2, "same claim must not repeat");
		await page.getByRole("button", { name: "일시 정지", exact: true }).click();
		await emit({
			type: "conversation.item.input_audio_transcription.completed",
			item_id: "u3",
			transcript: "개인정보를 안전하게 보관하는 기능입니다.",
		});
		await page.evaluate(() => (window.__offset += 80000));
		await page.waitForTimeout(1500);
		assert.equal(await count(), 2, "paused sessions must not ask");
		await page.getByRole("button", { name: "계속하기", exact: true }).click();
		await page.waitForTimeout(1500);
		assert.equal(await count(), 3);
		await emit({ type: "error", error: { code: "connection_failed" } });
		await page.getByRole("button", { name: "텍스트로 계속하기" }).click();
		await page
			.getByLabel("발표 내용", { exact: true })
			.fill("텍스트로 이어갑니다.");
		await page
			.getByRole("button", { name: "실시간 음성 연결", exact: true })
			.click();
		await page.getByText("답변을 듣고 있어요", { exact: true }).waitFor();
		assert.ok(
			requests
				.at(-1)
				.messages.some((m) => m.content.includes("기존 서비스보다")),
		);
		const draft = await page.evaluate(() =>
			JSON.parse(localStorage.getItem("rehearsal-draft-v1")),
		);
		assert.ok(
			draft.messages.find((m) => m.role === "user").voiceAnalysis
				.analysedSeconds > 0,
		);
		assert.deepEqual(errors, []);
		console.log(
			"PASS: claim-driven interruption, speech/cooldown/pause gates, deduplication, source linkage, voice per-answer capture, reconnect history and text fallback.",
		);
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
