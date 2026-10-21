const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
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
			viewport: { width: 1440, height: 1050 },
			acceptDownloads: true,
		});
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.goto(base);
		const imported = await page.evaluate(async () => {
			const response = await fetch("/api/import-url", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					url: "https://example.com",
					kind: "companyInfo",
				}),
			});
			return { status: response.status, body: await response.json() };
		});
		assert.equal(imported.status, 200);
		assert.equal(imported.body.title, "Example Domain");
		await page.waitForTimeout(1000);
		if (process.env.UPDATE_README_IMAGES)
			await page.screenshot({ path: "docs/images/home.png" });
		await page.getByRole("button", { name: "면접 연습", exact: true }).click();
		await page.route("**/api/import-url", (route) =>
			route.fulfill({ status: 422, json: { error: "테스트: 자동 수집 불가" } }),
		);
		const field = page.locator(".employer-field").first();
		assert.equal(await field.locator("textarea").count(), 0);
		await field.locator("input[type=url]").fill("https://example.com/job");
		await field
			.getByRole("button", { name: "URL 가져오기", exact: true })
			.click();
		await field.getByText(/테스트: 자동 수집 불가/).waitFor();
		assert.equal(await field.locator("textarea").count(), 0);
		await field.getByRole("button", { name: "수동 입력", exact: true }).click();
		await field
			.locator("textarea")
			.fill("사용자 경험을 개선하는 프론트엔드 개발자를 채용합니다.");
		await page.unroute("**/api/import-url");
		await page.getByRole("button", { name: "예시 불러오기" }).click();
		await page.getByText("데모 체험", { exact: true }).click();
		await page.getByRole("button", { name: "데모 연습 시작" }).click();
		if (process.env.UPDATE_README_IMAGES)
			await page
				.getByRole("dialog")
				.screenshot({ path: "docs/images/session-guide.png" });
		await page.keyboard.press("Escape");
		assert.ok(
			await page
				.getByRole("button", { name: "데모 연습 시작" })
				.evaluate((e) => e === document.activeElement),
		);
		await page.getByRole("button", { name: "데모 연습 시작" }).click();
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		assert.ok(
			await page
				.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
				.isDisabled(),
		);
		await page
			.getByRole("button", { name: "첫 질문 받기", exact: true })
			.click();
		await page
			.getByRole("button", { name: "말하기 분석 시작", exact: true })
			.click();
		await page.getByText(/마이크 분석 중/).waitFor();
		await page.waitForTimeout(6500);
		await page
			.getByRole("button", { name: "분석 마치기", exact: true })
			.click();
		await page
			.getByLabel("나의 답변", { exact: true })
			.fill(
				"팀 프로젝트에서 사용자 12명을 인터뷰했습니다. 입력 단계를 5단계에서 3단계로 줄이고 사용성 테스트로 확인했습니다.",
			);
		if (process.env.UPDATE_README_IMAGES) {
			await page.evaluate(() => scrollTo(0, 0));
			await page.screenshot({ path: "docs/images/report-action.png" });
		}
		await page.getByRole("button", { name: "답변 제출", exact: true }).click();
		await page
			.getByLabel("나의 답변", { exact: true })
			.fill("팀원들과 우선순위를 정하고 제가 입력 화면을 직접 구현했습니다.");
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page
			.getByRole("heading", { name: "오늘의 리허설을 돌아볼까요?" })
			.waitFor();
		let records = await page.evaluate(() =>
			JSON.parse(localStorage.getItem("rehearsal-records-v1")),
		);
		assert.equal(records.length, 1);
		assert.ok(records[0].voiceAnalysis.analysedSeconds >= 5);
		assert.equal(records[0].config.provider, "demo");
		if (process.env.UPDATE_README_IMAGES) {
			await page.evaluate(() => scrollTo(0, 0));
			await page.screenshot({ path: "docs/images/report.png" });
		}
		const pending = page.waitForEvent("download");
		await page
			.getByRole("button", { name: "리포트 저장", exact: true })
			.click();
		const download = await pending;
		const text = await fs.readFile(await download.path(), "utf8");
		assert.ok(text.includes("말하기 분석"));
		assert.ok(text.includes("사용자 12명"));
		await page.getByRole("button", { name: "다시 연습", exact: true }).click();
		await page.getByRole("button", { name: "돌아가기", exact: true }).click();
		await page.getByRole("button", { name: "발표 연습", exact: true }).click();
		await page.getByRole("button", { name: "예시 불러오기" }).click();
		await page.getByText("데모 체험", { exact: true }).click();
		await page.getByRole("button", { name: "데모 연습 시작" }).click();
		await page
			.getByRole("button", { name: "확인했어요 · 발표방 입장" })
			.click();
		await page
			.getByRole("button", { name: "첫 질문 받기", exact: true })
			.click();
		await page
			.getByLabel("발표 내용", { exact: true })
			.fill(
				"기숙사 학생을 위한 물품 대여 서비스를 만들었습니다. 초기 검증은 동아리 세 곳에서 진행할 계획입니다.",
			);
		await page.getByRole("button", { name: "발표 제출하고 질문 받기" }).click();
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page
			.getByRole("heading", { name: "오늘의 리허설을 돌아볼까요?" })
			.waitFor();
		for (const width of [320, 390, 768, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			await page.waitForTimeout(100);
			assert.ok(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			);
		}
		await page.reload();
		await page.waitForTimeout(700);
		await page.getByRole("button", { name: "연습 기록", exact: true }).click();
		assert.equal(await page.locator(".record-open").count(), 2);
		await page
			.getByRole("button", { name: /기록 삭제/ })
			.first()
			.click();
		await page.getByRole("button", { name: "취소", exact: true }).click();
		assert.equal(await page.locator(".record-open").count(), 2);
		await page
			.getByRole("button", { name: /기록 삭제/ })
			.first()
			.click();
		await page.getByRole("button", { name: "삭제하기", exact: true }).click();
		assert.equal(await page.locator(".record-open").count(), 1);
		await page.reload();
		await page.waitForTimeout(700);
		records = await page.evaluate(() =>
			JSON.parse(localStorage.getItem("rehearsal-records-v1")),
		);
		assert.equal(records.length, 1);
		assert.deepEqual(errors, []);
		console.log(
			"PASS: URL failure/manual input, interview + presentation demo, guide focus, microphone measurement, report/export, retry, persistence/deletion, 4 viewport widths.",
		);
	} finally {
		await browser.close();
	}
})().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
