const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { setup } = require("./camera-fixtures.cjs");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		const page = await browser.newPage({
			viewport: { width: 1440, height: 1050 },
		});
		const errors = [],
			requests = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("dialog", (dialog) => dialog.accept());
		await page.route("**/api/turn", (route) =>
			route.fulfill({
				json: {
					text: "프로젝트에서 본인이 맡은 역할은 무엇인가요?",
					sources: [],
				},
			}),
		);
		let fail = true;
		await page.route("**/api/report", (route) => {
			const data = route.request().postDataJSON();
			requests.push(data);
			if (fail) {
				fail = false;
				return route.fulfill({
					status: 502,
					json: { error: "검사용 리포트 실패" },
				});
			}
			const answer = data.messages.find((m) => m.role === "user").content;
			return route.fulfill({
				json: {
					summary: "검사용 피드백",
					strengths: [],
					improvements: [],
					exercises: [],
					evidence: [{ quote: answer, feedback: "행동을 설명하세요." }],
					answerFeedback: [
						{ answerNumber: 1, quote: answer, feedback: "본인 행동 확인" },
					],
					coverage: [
						{
							requirement: "테스트 경험",
							sourceQuote: "테스트",
							status: "unobserved",
							answerNumber: 0,
							quote: "",
							feedback: "이번 답변에서 미확인",
							question: "테스트를 진행한 경험은 무엇인가요?",
						},
					],
					comparison: data.retry?.previousAnswer
						? data.retry.criteria.map((criterion) => ({
								criterion,
								beforeQuote: data.retry.previousAnswer,
								afterQuote: answer,
								change: "improved",
								feedback: "검사용 비교",
							}))
						: [],
				},
			});
		});
		await setup(page);
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		await page
			.getByRole("button", { name: "첫 질문 받기", exact: true })
			.click();
		await page.getByRole("button", { name: "힌트 1단계 보기" }).click();
		await page
			.getByLabel("나의 답변", { exact: true })
			.fill("팀과 협업했습니다.");
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page.getByText(/검사용 리포트 실패/).waitFor();
		await page
			.getByRole("button", { name: "연습 종료 · 리포트 생성", exact: true })
			.click();
		await page.getByRole("button", { name: "질문별 복습 · 재도전" }).click();
		await page.getByRole("button", { name: "이 답변 다시 연습하기" }).click();
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		await page
			.getByLabel("나의 답변", { exact: true })
			.fill("제가 사용자 12명을 인터뷰하고 화면을 직접 개선했습니다.");
		await page.getByRole("button", { name: "답변 제출 · 결과 확인" }).click();
		await page
			.getByRole("heading", { name: "같은 질문의 전후 비교" })
			.waitFor();
		assert.equal(requests.at(-1).retry.previousAnswer, "팀과 협업했습니다.");
		assert.equal(requests.at(-1).retry.previousHints, 1);
		assert.equal(
			requests.at(-1).messages.filter((m) => m.role === "user").length,
			1,
		);
		assert.equal(
			await page.getByText("검사용 비교", { exact: true }).count(),
			3,
		);
		for (const width of [320, 390, 768, 1440]) {
			await page.setViewportSize({ width, height: 1000 });
			assert.ok(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth + 1,
				),
				`overflow ${width}`,
			);
		}
		await page
			.getByRole("heading", { name: "같은 질문의 전후 비교" })
			.scrollIntoViewIfNeeded();
		await page.screenshot({ path: "/tmp/rehearsal-learning-review.png" });
		await page.getByRole("button", { name: "이 역량 집중 연습" }).click();
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		await page.getByRole("button", { name: "힌트 1단계 보기" }).click();
		await page
			.getByLabel("나의 답변", { exact: true })
			.fill("아직 입력 중인 답변을 복원합니다.");
		await page.waitForTimeout(400);
		await page.reload();
		await page.getByRole("button", { name: "중단된 연습 이어가기" }).click();
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		assert.equal(
			await page.getByLabel("나의 답변", { exact: true }).inputValue(),
			"아직 입력 중인 답변을 복원합니다.",
		);
		await page.getByRole("button", { name: "계속하기", exact: true }).click();
		await page.getByRole("button", { name: "힌트 2단계 보기" }).waitFor();
		await page.getByRole("button", { name: "답변 제출 · 결과 확인" }).click();
		await page
			.getByRole("heading", { name: "오늘의 리허설을 돌아볼까요?" })
			.waitFor();
		assert.equal(
			await page.evaluate(() => localStorage.getItem("rehearsal-draft-v1")),
			null,
		);
		assert.equal(requests.at(-1).retry.previousAnswer, "");
		assert.deepEqual(errors, []);
		await page.getByRole("button", { name: "면접 연습", exact: true }).click();
		await page.getByRole("button", { name: "예시 불러오기" }).click();
		await page
			.getByLabel("연습 방식", { exact: true })
			.selectOption("simulation");
		await page
			.getByRole("button", { name: "리허설 시작", exact: false })
			.click();
		await page
			.getByRole("button", { name: "확인했어요 · 면접방 입장" })
			.click();
		await page
			.getByRole("button", { name: "첫 질문 받기", exact: true })
			.click();
		assert.equal(
			await page.getByRole("button", { name: "힌트 1단계 보기" }).count(),
			0,
		);
		await page.getByRole("button", { name: "연습실 홈", exact: true }).click();
		await page.getByRole("button", { name: "임시 기록 삭제" }).click();
		assert.equal(
			await page.evaluate(() => localStorage.getItem("rehearsal-draft-v1")),
			null,
		);
		console.log(
			"PASS: report failure/retry, hints, fixed-question retry/comparison, competency practice, reload recovery, draft deletion, simulation hides hints, 4 widths, no page errors.",
		);
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
