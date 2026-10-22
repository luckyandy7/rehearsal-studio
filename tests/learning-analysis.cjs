const assert = require("node:assert/strict");
const fs = require("node:fs");
const { transformSync } = require("next/dist/build/swc");
require.extensions[".ts"] = (module, file) =>
	module._compile(
		transformSync(fs.readFileSync(file, "utf8"), {
			filename: file,
			jsc: { parser: { syntax: "typescript" }, target: "es2022" },
			module: { type: "commonjs" },
		}).code,
		file,
	);
const { verifiedLearning } = require("../src/lib/server/learning-report.ts");
const {
	claimCandidate,
	mergeCamera,
	answerPairs,
} = require("../src/lib/learning.ts");
const { recordSchema, draftSchema } = require("../src/lib/types.ts");
const input = {
	mode: "interview",
	interviewContext: {
		jobPosting: "사용자 인터뷰와 테스트 경험",
		companyInfo: "",
		companyValues: "",
	},
	messages: [
		{ role: "assistant", content: "역할은?" },
		{ role: "user", content: "제가 사용자 12명을 인터뷰했습니다." },
	],
	retry: {
		question: "역할은?",
		previousAnswer: "팀과 협업했습니다.",
		criteria: ["본인 행동"],
		previousHints: 0,
	},
};
const report = {
	summary: "test",
	strengths: [],
	improvements: [],
	exercises: [],
	evidence: [],
	coverage: [
		{
			requirement: "인터뷰",
			sourceQuote: "사용자 인터뷰",
			status: "evidenced",
			answerNumber: 1,
			quote: "사용자 12명을",
			feedback: "확인",
			question: "어떻게?",
		},
		{
			requirement: "테스트",
			sourceQuote: "테스트 경험",
			status: "evidenced",
			answerNumber: 1,
			quote: "없는 답변",
			feedback: "잘함",
			question: "테스트는?",
		},
		{
			requirement: "없는 역량",
			sourceQuote: "보안",
			status: "evidenced",
			answerNumber: 1,
			quote: "사용자",
			feedback: "",
			question: "",
		},
	],
	answerFeedback: [
		{ answerNumber: 1, quote: "제가 사용자", feedback: "구체적" },
		{ answerNumber: 2, quote: "제가 사용자", feedback: "잘못된 연결" },
	],
	comparison: [
		{
			criterion: "본인 행동",
			beforeQuote: "협업했습니다",
			afterQuote: "인터뷰했습니다",
			change: "improved",
			feedback: "행동 구체화",
		},
		{
			criterion: "본인 행동",
			beforeQuote: "허위",
			afterQuote: "사용자",
			change: "improved",
			feedback: "허위",
		},
		{
			criterion: "임의 기준",
			beforeQuote: "협업",
			afterQuote: "사용자",
			change: "improved",
			feedback: "허위",
		},
	],
};
const verified = verifiedLearning(input, report);
assert.equal(verified.coverage.length, 2);
assert.equal(verified.coverage[1].status, "unobserved");
assert.equal(verified.coverage[1].quote, "");
assert.equal(verified.answerFeedback.length, 1);
assert.equal(verified.comparison.length, 2);
assert.equal(verified.comparison[1].change, "insufficient");
assert.equal(
	verifiedLearning(
		{
			...input,
			messages: [
				...input.messages,
				{ role: "user", content: "추가로 화면을 수정했습니다." },
			],
		},
		{
			...report,
			comparison: [
				{ ...report.comparison[0], afterQuote: "화면을 수정했습니다" },
			],
		},
	).comparison[0].change,
	"improved",
);
assert.deepEqual(
	verifiedLearning({ ...input, mode: "presentation", retry: undefined }, report)
		.coverage,
	[],
);
assert.deepEqual(
	verifiedLearning({ ...input, retry: undefined }, report).comparison,
	[],
);
assert.equal(
	claimCandidate("저희 서비스는 기존 서비스보다 정확합니다.").reason,
	"성능·개선 주장",
);
assert.equal(claimCandidate("오늘 발표를 시작하겠습니다."), null);
assert.equal(answerPairs(input.messages)[0].question.content, "역할은?");
const camera = {
	version: 1,
	settings: { reference: "allowed", feedback: "review", shareSummary: false },
	sampledSeconds: 8,
	faceSeconds: 7,
	poseSeconds: 6,
	sufficient: false,
	calibrated: true,
	events: [{ kind: "head-away", start: 1, end: 4, answer: 1 }],
	truncated: false,
};
const merged = mergeCamera(
	camera,
	{ ...camera, events: [{ kind: "head-away", start: 1, end: 4, answer: 2 }] },
	12,
);
assert.equal(merged.events[1].start, 13);
assert.equal(merged.sampledSeconds, 16);
assert.equal(merged.sufficient, true);
assert.equal(
	mergeCamera(
		{ ...camera, settings: { ...camera.settings, shareSummary: true } },
		null,
		0,
		camera.settings,
	).settings.shareSummary,
	false,
);
const config = {
	mode: "interview",
	material: "자기소개서 내용입니다. 프로젝트에서 인터뷰했습니다.",
	role: "개발자",
	difficulty: "normal",
	durationMinutes: 5,
	provider: "demo",
	fileName: "",
};
assert.equal(
	recordSchema.parse({
		id: "old",
		createdAt: "2026-10-22",
		config,
		messages: [],
		report: {
			summary: "old",
			strengths: [],
			improvements: [],
			exercises: [],
			evidence: [],
		},
		elapsedSeconds: 1,
	}).config.practiceStyle,
	"coaching",
);
assert.ok(
	draftSchema.safeParse({
		version: 1,
		id: "draft",
		updatedAt: "now",
		config,
		messages: input.messages,
		answer: "미완성",
		seconds: 5,
		hintsUsed: 2,
	}).success,
);
assert.equal(draftSchema.safeParse({ version: 2 }).success, false);
console.log(
	"PASS: quote provenance, answer indexing, fixed comparison criteria, missing evidence downgrade, claim extraction, camera resume merge, legacy records and draft validation.",
);
