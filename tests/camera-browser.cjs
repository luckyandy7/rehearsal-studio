const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { setup, mockCamera, calibrate } = require("./camera-fixtures.cjs");
const report = {
	summary: "테스트 리포트",
	strengths: ["답변 기록"],
	improvements: ["근거 보충"],
	exercises: ["다시 연습"],
	evidence: [],
};
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
		// Permission failure must not block entry, and cancellation must stop late streams.
		let page = await browser.newPage();
		await page.addInitScript(() => {
			navigator.mediaDevices.getUserMedia = async () => {
				throw new DOMException("denied", "NotAllowedError");
			};
		});
		await setup(page);
		await page
			.getByRole("button", { name: "카메라 켜기", exact: true })
			.click();
		await page
			.getByRole("alert")
			.filter({ hasText: "카메라 권한이 거부" })
			.waitFor();
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		await page
			.getByRole("button", { name: "첫 질문 받기", exact: true })
			.waitFor();
		await page.close();
		console.log("PASS denied permission -> session");
		page = await browser.newPage();
		await page.addInitScript(() => {
			const original = navigator.mediaDevices.getUserMedia.bind(
				navigator.mediaDevices,
			);
			window.__tracks = [];
			navigator.mediaDevices.getUserMedia = async (options) => {
				await new Promise((r) => setTimeout(r, 1000));
				const media = await original(options);
				window.__tracks.push(...media.getTracks());
				return media;
			};
		});
		await setup(page);
		await page
			.getByRole("button", { name: "카메라 켜기", exact: true })
			.click();
		await page.getByRole("button", { name: "카메라 없이 진행" }).click();
		await page.waitForTimeout(2000);
		assert.ok(
			await page.evaluate(
				() =>
					window.__tracks.length > 0 &&
					window.__tracks.every((t) => t.readyState === "ended"),
			),
		);
		await page.close();
		console.log("PASS pending permission cancellation releases late stream");
		page = await browser.newPage({
			viewport: { width: 1440, height: 1000 },
			acceptDownloads: true,
		});
		await page.addInitScript(mockCamera);
		let calls = [];
		let failed = false;
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.route("**/api/turn", (r) =>
			r.fulfill({
				json: {
					text: "프로젝트에서 직접 한 행동을 설명해 주세요.",
					sources: [],
				},
			}),
		);
		await page.route("**/api/report", (r) => {
			calls.push(r.request().postDataJSON());
			if (!failed) {
				failed = true;
				return r.fulfill({ status: 502, json: { error: "테스트 오류" } });
			}
			return r.fulfill({ json: report });
		});
		await setup(page);
		await calibrate(page);
		for (const width of [320, 390, 768, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			await page.waitForTimeout(150);
			assert.ok(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			);
			const box = await page
				.getByRole("button", { name: "확인했어요 · 면접방 입장" })
				.boundingBox();
			assert.ok(box && box.y >= 0 && box.y + box.height <= 900);
		}
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		await page
			.getByRole("button", { name: "첫 질문 받기", exact: true })
			.click();
		await page
			.getByRole("button", { name: "답변 측정 시작", exact: true })
			.click();
		await page.evaluate(() => (window.__frameKind = "away"));
		await page.waitForTimeout(4500);
		await page.getByRole("button", { name: "일시 정지", exact: true }).click();
		await page.waitForTimeout(1000);
		await page.getByRole("button", { name: "계속하기", exact: true }).click();
		await page.evaluate(() => (window.__frameKind = "normal"));
		await page.waitForTimeout(7500);
		await page
			.getByLabel("나의 답변", { exact: true })
			.fill("사용자 인터뷰를 진행하고 입력 단계를 줄였습니다.");
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page
			.getByRole("alert")
			.filter({ hasText: "대화 기록은 유지" })
			.waitFor();
		assert.equal(calls[0].cameraAnalysis, undefined);
		assert.ok(
			await page.evaluate(
				() =>
					window.__tracks.every((t) => t.readyState === "ended") &&
					window.__workers.every((w) => w.terminated),
			),
		);
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page
			.getByRole("button", { name: "시선·자세 · 측정 결과", exact: true })
			.click();
		let record = await page.evaluate(
			() => JSON.parse(localStorage.getItem("rehearsal-records-v1"))[0],
		);
		assert.ok(record.cameraAnalysis.sufficient);
		assert.ok(record.cameraAnalysis.events.some((e) => e.kind === "head-away"));
		assert.equal(record.cameraAnalysis.events[0].answer, 1);
		assert.ok(record.cameraAnalysis.sampledSeconds < 13);
		const download = page.waitForEvent("download");
		await page
			.getByRole("button", { name: "리포트 저장", exact: true })
			.click();
		const text = await fs.readFile(await (await download).path(), "utf8");
		assert.ok(text.includes("시선·자세 코칭"));
		assert.ok(text.includes("답변 1"));
		for (const width of [320, 390, 768, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			await page.waitForTimeout(150);
			assert.ok(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			);
			await page.screenshot({
				path: `artifacts/camera-report-${width}.png`,
				fullPage: true,
			});
		}
		await page.reload();
		await page.waitForTimeout(800);
		await page.getByRole("button", { name: "연습 기록", exact: true }).click();
		await page.getByText("신입 프론트엔드 개발자", { exact: true }).click();
		await page
			.getByRole("button", { name: "시선·자세 · 측정 결과", exact: true })
			.click();
		await page
			.getByText("기준 범위를 벗어난 얼굴 방향", { exact: true })
			.waitFor();
		assert.deepEqual(errors, []);
		console.log(
			"PASS calibration, mobile, sampling/pause, report retry, consent off, teardown, export, history",
		);
		await page.getByRole("button", { name: "다시 연습", exact: true }).click();
		await page.getByLabel("측정 요약을 OpenAI 리포트에도 사용하기").check();
		await calibrate(page);
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		await page
			.getByLabel("나의 답변", { exact: true })
			.fill("새로운 답변입니다. 직접 테스트했습니다.");
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page
			.getByRole("button", { name: "시선·자세 · 측정 결과", exact: true })
			.waitFor();
		assert.equal(calls.at(-1).cameraAnalysis.settings.shareSummary, true);
		assert.equal(calls.at(-1).cameraAnalysis.sampledSeconds, 0);
		assert.equal(calls.at(-1).cameraAnalysis.sufficient, false);
		console.log("PASS consent on + fresh retry + insufficient data");
		await page.close();
	} finally {
		await browser.close();
	}
})().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
