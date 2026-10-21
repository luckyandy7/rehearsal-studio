const assert = require("node:assert/strict");
const fs = require("node:fs");
const { transformSync } = require("next/dist/build/swc");
require.extensions[".ts"] = (module, path) => {
	const { code } = transformSync(fs.readFileSync(path, "utf8"), {
		filename: path,
		jsc: { parser: { syntax: "typescript" }, target: "es2022" },
		module: { type: "commonjs" },
	});
	module._compile(code, path);
};
const {
	features,
	makeBaseline,
	classify,
	CameraAccumulator,
	cameraAnalysisSchema,
	defaultCameraSettings,
} = require("../src/lib/camera-analysis.ts");
const { recordSchema } = require("../src/lib/types.ts");
function frame() {
	const f = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
	const set = (i, x, y) => (f[i] = { x, y });
	set(234, 0.25, 0.5);
	set(454, 0.75, 0.5);
	set(1, 0.5, 0.5);
	set(10, 0.5, 0.15);
	set(152, 0.5, 0.85);
	set(33, 0.36, 0.35);
	set(263, 0.64, 0.35);
	set(13, 0.5, 0.65);
	set(133, 0.44, 0.35);
	set(159, 0.4, 0.34);
	set(145, 0.4, 0.36);
	set(468, 0.4, 0.35);
	const pose = Array.from({ length: 33 }, () => ({
		x: 0,
		y: 0,
		visibility: 0,
	}));
	pose[11] = { x: 0.2, y: 0.8, visibility: 1 };
	pose[12] = { x: 0.8, y: 0.8, visibility: 1 };
	return { faces: [f], pose };
}
const zeroVisibility = frame();
zeroVisibility.faces[0].forEach((p) => (p.visibility = 0));
assert.ok(
	features(zeroVisibility),
	"FaceLandmarker visibility=0 is not pose confidence",
);
const base = makeBaseline(Array.from({ length: 50 }, () => features(frame())));
assert.ok(base);
assert.equal(makeBaseline([]), null);
assert.deepEqual(classify(frame(), base), []);
let bad = frame();
bad.faces[0][1].x = 0.7;
assert.ok(classify(bad, base).includes("head-away"));
let eyes = frame();
eyes.faces[0][468].x = 0.44;
assert.ok(classify(eyes, base).includes("eyes-away"));
let blink = frame();
blink.faces[0][145].y = 0.341;
assert.ok(!classify(blink, base).includes("eyes-away"));
assert.deepEqual(classify({ faces: [], pose: [] }, base), ["face-missing"]);
assert.deepEqual(
	classify({ faces: [frame().faces[0], frame().faces[0]], pose: [] }, base),
	["multiple-faces"],
);
let gesture = frame();
gesture.pose[15] = { x: 0.5, y: 0.5, visibility: 1 };
assert.ok(classify(gesture, base).includes("hand-face"));
gesture.pose[15].visibility = 0.1;
assert.ok(!classify(gesture, base).includes("hand-face"));
let body = frame();
body.pose[11].x = 0.4;
body.pose[12].x = 1;
assert.ok(classify(body, base).includes("body-shift"));
const run = (acc, fr, start, end, answer = 1) => {
	for (let i = start; i <= end; i += 0.15) acc.sample(fr, i, answer);
};
const acc = new CameraAccumulator(defaultCameraSettings, base);
run(acc, bad, 0, 2);
acc.boundary();
assert.equal(acc.snapshot().events.length, 0);
run(acc, bad, 3, 8);
acc.boundary();
assert.equal(acc.snapshot().events.length, 1);
run(acc, frame(), 9, 20);
acc.boundary();
const a = acc.snapshot();
assert.ok(a.sufficient);
assert.ok(cameraAnalysisSchema.safeParse(a).success);
const pause = new CameraAccumulator(defaultCameraSettings, base);
run(pause, bad, 0, 2);
pause.boundary();
run(pause, bad, 100, 102);
pause.boundary();
assert.equal(pause.snapshot().events.length, 0);
assert.ok(pause.snapshot().sampledSeconds < 5);
const split = new CameraAccumulator(defaultCameraSettings, base);
run(split, bad, 0, 2);
run(split, bad, 2.1, 4, 2);
split.boundary();
assert.equal(split.snapshot().events.length, 0);
const missing = new CameraAccumulator(defaultCameraSettings, base);
run(missing, { faces: [], pose: [] }, 0, 20);
assert.equal(missing.snapshot().sufficient, false);
assert.equal(missing.snapshot().faceSeconds, 0);
const long = new CameraAccumulator(defaultCameraSettings, base);
for (let i = 0; i < 85; i++) {
	run(long, bad, i * 5, i * 5 + 4);
	long.boundary();
}
assert.equal(long.snapshot().events.length, 80);
assert.equal(long.snapshot().truncated, true);
const old = {
	id: "legacy",
	createdAt: new Date().toISOString(),
	config: {
		mode: "interview",
		material: "a".repeat(20),
		role: "dev",
		difficulty: "normal",
		durationMinutes: 5,
		provider: "demo",
		fileName: "",
	},
	messages: [],
	report: {
		summary: "test",
		strengths: [],
		improvements: [],
		exercises: [],
		evidence: [],
	},
	elapsedSeconds: 0,
};
assert.ok(recordSchema.safeParse(old).success);
assert.ok(recordSchema.safeParse({ ...old, cameraAnalysis: a }).success);
assert.ok(
	!cameraAnalysisSchema.safeParse({ ...a, faceSeconds: a.sampledSeconds + 1 })
		.success,
);
console.log(
	"PASS: geometry, baseline, blink/occlusion, multi-face, gestures, duration thresholds, pauses, answer boundaries, coverage, event cap, legacy storage, schema.",
);
