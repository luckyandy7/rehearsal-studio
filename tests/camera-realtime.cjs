const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { setup, mockCamera, calibrate } = require("./camera-fixtures.cjs");
function mockRealtime() {
	window.RTCPeerConnection = class {
		createDataChannel() {
			this.channel = {
				readyState: "open",
				send() {},
				close() {
					this.readyState = "closed";
				},
			};
			window.__rtEvent = (data) =>
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
		const page = await browser.newPage({
			viewport: { width: 1280, height: 900 },
		});
		await page.addInitScript(mockCamera);
		await page.addInitScript(mockRealtime);
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.route("**/api/realtime", (r) =>
			r.fulfill({ json: { sdp: "v=0\r\n" } }),
		);
		await page.route("**/api/report", (r) =>
			r.fulfill({
				json: {
					summary: "테스트",
					strengths: [],
					improvements: [],
					exercises: [],
					evidence: [],
				},
			}),
		);
		await setup(page, "발표");
		await calibrate(page);
		await page
			.getByRole("button", { name: "확인했어요 · 발표방 입장" })
			.click();
		await page
			.getByRole("button", { name: "실시간 음성 연결", exact: true })
			.click();
		await page.getByText("답변을 듣고 있어요", { exact: true }).waitFor();
		const emit = async (event) =>
			page.evaluate((e) => window.__rtEvent(e), event);
		await emit({
			type: "response.output_audio_transcript.done",
			item_id: "a1",
			transcript: "발표를 시작해 주세요.",
		});
		await page.evaluate(() => (window.__frameKind = "away"));
		// Idle listening and AI speech must not accrue camera time.
		await page.waitForTimeout(1500);
		await emit({ type: "output_audio_buffer.started" });
		await page.waitForTimeout(1500);
		await emit({ type: "output_audio_buffer.stopped" });
		await emit({ type: "input_audio_buffer.speech_started" });
		await page.waitForTimeout(4200);
		await emit({ type: "input_audio_buffer.speech_stopped" });
		await emit({
			type: "conversation.item.input_audio_transcription.completed",
			item_id: "u1",
			transcript:
				"첫 발표 답변입니다. 사용자 문제를 해결하는 기능을 개발했습니다.",
		});
		await page.getByRole("button", { name: "일시 정지", exact: true }).click();
		await emit({ type: "input_audio_buffer.speech_started" });
		await page.waitForTimeout(1500);
		await page.getByRole("button", { name: "계속하기", exact: true }).click();
		await emit({ type: "input_audio_buffer.speech_stopped" });
		// Camera off and recalibration must retain the first answer's observations.
		await page
			.getByRole("button", { name: "카메라 끄기", exact: true })
			.click();
		await page
			.getByRole("button", { name: "카메라 켜기", exact: true })
			.click();
		await page.evaluate(() => (window.__frameKind = "normal"));
		await page.getByRole("button", { name: "기준 자세 보정 · 10초" }).click();
		await page
			.getByRole("button", { name: "카메라 끄기", exact: true })
			.waitFor({ timeout: 20000 });
		await emit({ type: "input_audio_buffer.speech_started" });
		await page.waitForTimeout(3000);
		await emit({ type: "input_audio_buffer.speech_stopped" });
		await emit({
			type: "conversation.item.input_audio_transcription.completed",
			item_id: "u2",
			transcript: "두 번째 답변입니다. 사용자 테스트를 진행했습니다.",
		});
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page
			.getByRole("button", { name: "시선·자세 · 측정 결과", exact: true })
			.click();
		const record = await page.evaluate(
			() => JSON.parse(localStorage.getItem("rehearsal-records-v1"))[0],
		);
		assert.ok(
			record.cameraAnalysis.sampledSeconds >= 6 &&
				record.cameraAnalysis.sampledSeconds < 9,
			JSON.stringify(record.cameraAnalysis),
		);
		assert.ok(
			record.cameraAnalysis.events.some(
				(e) => e.kind === "head-away" && e.answer === 1,
			),
		);
		assert.equal(record.config.mode, "presentation");
		assert.ok(
			await page.evaluate(
				() =>
					window.__tracks.every((t) => t.readyState === "ended") &&
					window.__workers.every((w) => w.terminated),
			),
		);
		assert.deepEqual(errors, []);
		console.log(
			"PASS real hook + mocked RTC: VAD, AI/idle/pause exclusion, reconnect/recalibration keeps results, presentation report, stream teardown.",
		);
	} finally {
		await browser.close();
	}
})().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
