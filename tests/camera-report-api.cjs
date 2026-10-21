const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { transformSync } = require("next/dist/build/swc");
require.extensions[".ts"] = (module, file) => {
	module._compile(
		transformSync(fs.readFileSync(file, "utf8"), {
			filename: file,
			jsc: { parser: { syntax: "typescript" }, target: "es2022" },
			module: { type: "commonjs" },
		}).code,
		file,
	);
};
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
	return resolve.call(
		this,
		request.startsWith("@/") ? path.resolve("src", request.slice(2)) : request,
		...args,
	);
};
let captured;
const aiFile = path.resolve("src/lib/server/ai.ts");
require.cache[aiFile] = {
	id: aiFile,
	filename: aiFile,
	loaded: true,
	exports: {
		reportModel: () => "mock-model",
		client: () => ({
			responses: {
				parse: async (payload) => {
					captured = payload;
					return {
						status: "completed",
						output_parsed: {
							summary: "test",
							strengths: [],
							improvements: [],
							exercises: [],
							evidence: [],
						},
					};
				},
			},
		}),
	},
};
const { POST } = require("../src/app/api/report/route.ts");
const config = {
	mode: "interview",
	material: "테스트 자료",
	role: "개발자",
	difficulty: "normal",
	messages: [{ role: "user", content: "제가 직접 인터뷰했습니다." }],
};
const analysis = {
	version: 1,
	settings: { reference: "closed", feedback: "review", shareSummary: false },
	sampledSeconds: 15,
	faceSeconds: 12,
	poseSeconds: 8,
	sufficient: true,
	calibrated: true,
	events: [{ kind: "head-away", start: 1, end: 5, answer: 1 }],
	truncated: false,
};
const call = (body) =>
	POST(
		new Request("http://localhost/api/report", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);
(async () => {
	assert.equal(
		(await call({ ...config, cameraAnalysis: analysis })).status,
		200,
	);
	assert.equal(JSON.parse(captured.input).cameraAnalysis, undefined);
	assert.equal(
		(
			await call({
				...config,
				cameraAnalysis: {
					...analysis,
					settings: { ...analysis.settings, shareSummary: true },
					frames: "must be stripped",
				},
			})
		).status,
		200,
	);
	assert.equal(
		JSON.parse(captured.input).cameraAnalysis.settings.shareSummary,
		true,
	);
	assert.equal(JSON.parse(captured.input).cameraAnalysis.frames, undefined);
	assert.ok(captured.instructions.includes("부정행위"));
	assert.ok(captured.instructions.includes("측정 부족"));
	assert.equal(
		(
			await call({
				...config,
				cameraAnalysis: { ...analysis, faceSeconds: 16 },
			})
		).status,
		400,
	);
	assert.equal((await call(config)).status, 200);
	console.log(
		"PASS report endpoint: default/false consent stripping, true consent forwarding, unknown frame rejection by schema stripping, malformed metrics 400, legacy request.",
	);
})().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
