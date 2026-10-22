const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const reducedMotion of ["no-preference", "reduce"]) {
			const page = await browser.newPage({
				reducedMotion,
				viewport: { width: 1280, height: 900 },
			});
			const errors = [];
			page.on("pageerror", (e) => errors.push(e.message));
			await page.goto(base);
			await page
				.getByRole("button", { name: "면접 연습", exact: true })
				.click();
			await page.getByRole("button", { name: "예시 불러오기" }).click();
			await page.getByText("데모 체험", { exact: true }).click();
			await page.getByRole("button", { name: "데모 연습 시작" }).click();
			await page
				.getByRole("button", { name: "확인했어요 · 면접방 입장" })
				.click();
			await page
				.getByRole("button", { name: "첫 질문 받기", exact: true })
				.click();
			await page
				.getByLabel("나의 답변", { exact: true })
				.fill("사용자 인터뷰를 직접 진행했습니다.");
			await page
				.getByRole("button", { name: "연습실 홈", exact: true })
				.click();
			const dialog = page.getByRole("alertdialog");
			await dialog.waitFor();
			await page.waitForFunction(
				() => document.activeElement?.textContent === "취소",
			);
			await page.keyboard.press("Shift+Tab");
			assert.equal(
				await page.evaluate(() => document.activeElement?.textContent),
				"저장하고 나가기",
			);
			await page.keyboard.press("Tab");
			assert.equal(
				await page.evaluate(() => document.activeElement?.textContent),
				"취소",
			);
			await page.mouse.click(5, 5);
			assert.equal(await dialog.count(), 1);
			await page.keyboard.press("Escape");
			await page.waitForFunction(() =>
				document.activeElement?.textContent?.includes("연습실 홈"),
			);
			assert.equal(
				await page.getByLabel("나의 답변", { exact: true }).inputValue(),
				"사용자 인터뷰를 직접 진행했습니다.",
			);
			await page
				.getByRole("button", { name: "연습실 홈", exact: true })
				.click();
			await page
				.getByRole("button", { name: "저장하고 나가기", exact: true })
				.click();
			await page
				.getByRole("button", { name: "임시 기록 삭제", exact: true })
				.click();
			if (reducedMotion === "reduce")
				assert.ok(
					await dialog.evaluate(
						(element) =>
							parseFloat(getComputedStyle(element).animationDuration) < 0.001,
					),
				);
			for (const width of [320, 390, 768, 1280]) {
				await page.setViewportSize({ width, height: 900 });
				const box = await dialog.boundingBox();
				assert.ok(
					box &&
						box.x >= 0 &&
						box.x + box.width <= width + 1 &&
						box.y >= 0 &&
						box.y + box.height <= 900,
				);
			}
			if (reducedMotion === "no-preference")
				await page.screenshot({ path: "/tmp/rehearsal-confirmation.png" });
			await page.getByRole("button", { name: "취소", exact: true }).click();
			await page
				.getByRole("button", { name: "면접 연습", exact: true })
				.click();
			await page.getByRole("button", { name: "예시 불러오기" }).click();
			await page.getByText("데모 체험", { exact: true }).click();
			await page.getByRole("button", { name: "데모 연습 시작" }).click();
			await page
				.getByRole("heading", { name: "새 연습으로 바꿀까요?" })
				.waitFor();
			await page.getByRole("button", { name: "취소", exact: true }).click();
			assert.ok(
				await page.evaluate(() => !!localStorage.getItem("rehearsal-draft-v1")),
			);
			await page.getByRole("button", { name: "데모 연습 시작" }).click();
			await page
				.getByRole("button", { name: "새 연습 준비", exact: true })
				.click();
			await page.getByRole("dialog").waitFor();
			await page.keyboard.press("Escape");
			await page
				.getByRole("button", { name: "임시 기록 삭제", exact: true })
				.click();
			await page
				.getByRole("button", { name: "임시 기록 삭제하기", exact: true })
				.click();
			await page.waitForFunction(
				() => localStorage.getItem("rehearsal-draft-v1") === null,
			);
			assert.deepEqual(errors, []);
			await page.close();
		}
		console.log(
			"PASS: modal cancel/confirm, keyboard trap/Escape/focus return, outside click protection, replacement-to-guide handoff, draft preservation/deletion, 4 widths and reduced motion.",
		);
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
