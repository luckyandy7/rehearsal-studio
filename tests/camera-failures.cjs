const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { setup, mockCamera } = require("./camera-fixtures.cjs");
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
		let page = await browser.newPage();
		await page.addInitScript(mockCamera);
		await page.addInitScript(() => {
			const W = Worker;
			window.Worker = class extends W {
				postMessage(data) {
					if (data.type === "init") {
						setTimeout(() => this.onmessage?.({ data: { type: "error" } }), 10);
					} else super.postMessage(data);
				}
			};
		});
		await setup(page);
		await page
			.getByRole("button", { name: "카메라 켜기", exact: true })
			.click();
		await page.getByRole("alert").filter({ hasText: "분석 모델" }).waitFor();
		assert.ok(
			await page.evaluate(
				() =>
					window.__tracks.every((t) => t.readyState === "ended") &&
					window.__workers.every((w) => w.terminated),
			),
		);
		await page.keyboard.press("Escape");
		assert.equal(
			await page
				.getByRole("button", { name: "리허설 시작", exact: false })
				.evaluate((e) => e === document.activeElement),
			true,
		);
		await page.close();
		console.log("PASS model failure releases camera; Escape restores focus");
		page = await browser.newPage();
		await page.addInitScript(mockCamera);
		await setup(page);
		await page
			.getByRole("button", { name: "카메라 켜기", exact: true })
			.click();
		await page.getByRole("button", { name: "기준 자세 보정 · 10초" }).waitFor();
		await page.evaluate(() => (window.__frameKind = "missing"));
		await page.getByRole("button", { name: "기준 자세 보정 · 10초" }).click();
		await page
			.getByRole("alert")
			.filter({ hasText: "안정적인 기준 자세" })
			.waitFor({ timeout: 20000 });
		assert.ok(
			await page
				.getByRole("button", { name: "확인했어요 · 면접방 입장" })
				.isDisabled(),
		);
		await page.getByRole("button", { name: "카메라 없이 진행" }).click();
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		assert.ok(
			await page.evaluate(() =>
				window.__tracks.every((t) => t.readyState === "ended"),
			),
		);
		await page.close();
		console.log("PASS no-face calibration rejected; optional entry works");
	} finally {
		await browser.close();
	}
})().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
