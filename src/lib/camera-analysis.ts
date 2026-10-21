import { z } from "zod";

export const cameraSettingsSchema = z.object({
	reference: z.enum(["allowed", "closed"]).default("allowed"),
	feedback: z.enum(["review", "live"]).default("review"),
	shareSummary: z.boolean().default(false),
});
export type CameraSettings = z.infer<typeof cameraSettingsSchema>;
export const defaultCameraSettings: CameraSettings = {
	reference: "allowed",
	feedback: "review",
	shareSummary: false,
};
export const cameraEventKinds = [
	"head-away",
	"eyes-away",
	"face-missing",
	"multiple-faces",
	"body-shift",
	"hand-face",
] as const;
export type CameraEventKind = (typeof cameraEventKinds)[number];
const seconds = z.number().finite().min(0).max(86400);
export const cameraEventSchema = z
	.object({
		kind: z.enum(cameraEventKinds),
		start: seconds,
		end: seconds,
		answer: z.number().int().min(1).max(81),
	})
	.refine((e) => e.end >= e.start);
export const cameraAnalysisSchema = z
	.object({
		version: z.literal(1),
		settings: cameraSettingsSchema,
		sampledSeconds: seconds,
		faceSeconds: seconds,
		poseSeconds: seconds,
		sufficient: z.boolean(),
		calibrated: z.boolean(),
		events: z.array(cameraEventSchema).max(80),
		truncated: z.boolean(),
	})
	.refine(
		(a) =>
			a.faceSeconds <= a.sampledSeconds && a.poseSeconds <= a.sampledSeconds,
	);
export type CameraAnalysis = z.infer<typeof cameraAnalysisSchema>;
export type CameraEvent = z.infer<typeof cameraEventSchema>;
export type Point = { x: number; y: number; z?: number; visibility?: number };
export type CameraFrame = { faces: Point[][]; pose: Point[] };
export type Features = {
	headX: number;
	headY: number;
	eyeX: number | null;
	eyeY: number | null;
	bodyX: number | null;
	tilt: number | null;
	handFace: boolean;
};
export type Baseline = { min: Features; max: Features };
const coordinates = (p: Point | undefined): p is Point =>
	!!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const visible = (p: Point | undefined): p is Point =>
	!!p &&
	Number.isFinite(p.x) &&
	Number.isFinite(p.y) &&
	(p.visibility ?? 1) >= 0.65;
export function features(frame: CameraFrame): Features | null {
	if (frame.faces.length !== 1) return null;
	const f = frame.faces[0];
	if (!f) return null;
	const left = f[234],
		right = f[454],
		nose = f[1],
		top = f[10],
		chin = f[152],
		eyeL = f[33],
		eyeR = f[263],
		mouth = f[13];
	if (
		![left, right, nose, top, chin, eyeL, eyeR, mouth].every(coordinates) ||
		!left ||
		!right ||
		!nose ||
		!top ||
		!chin ||
		!eyeL ||
		!eyeR ||
		!mouth
	)
		return null;
	const width = Math.abs(right.x - left.x),
		height = chin.y - top.y;
	if (
		width < 0.12 ||
		height < 0.15 ||
		top.y < 0.01 ||
		chin.y > 0.99 ||
		Math.min(left.x, right.x) < 0.01 ||
		Math.max(left.x, right.x) > 0.99
	)
		return null;
	const iris = f[468],
		inner = f[133],
		upper = f[159],
		lower = f[145];
	const eyeWidth = inner ? Math.abs(inner.x - eyeL.x) : 0;
	const eyeHeight = upper && lower ? lower.y - upper.y : 0;
	const eyeGood =
		iris &&
		inner &&
		upper &&
		lower &&
		eyeWidth > 0.02 &&
		eyeHeight / eyeWidth > 0.12;
	const shoulderL = frame.pose[11],
		shoulderR = frame.pose[12];
	const shoulders = visible(shoulderL) && visible(shoulderR);
	const bodyWidth = shoulders ? Math.abs(shoulderR.x - shoulderL.x) : 0;
	const wrists = [frame.pose[15], frame.pose[16]];
	return {
		headX: (nose.x - (left.x + right.x) / 2) / width,
		headY:
			(nose.y - (eyeL.y + eyeR.y) / 2) /
			Math.max(0.02, mouth.y - (eyeL.y + eyeR.y) / 2),
		eyeX: eyeGood ? (iris.x - eyeL.x) / (inner.x - eyeL.x) : null,
		eyeY: eyeGood ? (iris.y - (upper.y + lower.y) / 2) / eyeWidth : null,
		bodyX:
			shoulders && bodyWidth > 0.1
				? ((shoulderL.x + shoulderR.x) / 2 - 0.5) / bodyWidth
				: null,
		tilt:
			shoulders && bodyWidth > 0.1
				? (shoulderR.y - shoulderL.y) / bodyWidth
				: null,
		handFace: wrists.some(
			(p) =>
				visible(p) &&
				p.x > Math.min(left.x, right.x) &&
				p.x < Math.max(left.x, right.x) &&
				p.y > top.y &&
				p.y < chin.y,
		),
	};
}
export function makeBaseline(samples: Features[]): Baseline | null {
	if (samples.length < 30) return null;
	const min = { ...samples[0] } as Features,
		max = { ...samples[0] } as Features;
	for (const key of [
		"headX",
		"headY",
		"eyeX",
		"eyeY",
		"bodyX",
		"tilt",
	] as const) {
		const values = samples
			.map((s) => s[key])
			.filter((v): v is number => v !== null)
			.sort((a, b) => a - b);
		const lo = values[Math.floor(values.length * 0.1)],
			hi = values[Math.floor(values.length * 0.9)];
		if (lo !== undefined && hi !== undefined) {
			min[key] = lo;
			max[key] = hi;
		}
	}
	// Reject a moving/poorly framed calibration instead of treating it as normal.
	if (max.headX - min.headX > 0.18 || max.headY - min.headY > 0.4) return null;
	return { min, max };
}
export function classify(
	frame: CameraFrame,
	baseline: Baseline,
): CameraEventKind[] {
	if (frame.faces.length > 1) return ["multiple-faces"];
	const f = features(frame);
	if (!f) return ["face-missing"];
	const outside = (key: keyof Omit<Features, "handFace">, margin: number) => {
		const v = f[key],
			lo = baseline.min[key],
			hi = baseline.max[key];
		return (
			v !== null &&
			lo !== null &&
			hi !== null &&
			(v < lo - margin || v > hi + margin)
		);
	};
	const events: CameraEventKind[] = [];
	const head = outside("headX", 0.12) || outside("headY", 0.22);
	if (head) events.push("head-away");
	if (!head && (outside("eyeX", 0.18) || outside("eyeY", 0.12)))
		events.push("eyes-away");
	if (outside("bodyX", 0.22) || outside("tilt", 0.18))
		events.push("body-shift");
	if (f.handFace) events.push("hand-face");
	return events;
}
export const cameraLabels: Record<CameraEventKind, string> = {
	"head-away": "기준 범위를 벗어난 얼굴 방향",
	"eyes-away": "눈 방향 변화 추정 · 실험",
	"face-missing": "얼굴 측정 어려움",
	"multiple-faces": "여러 얼굴 감지",
	"body-shift": "상체 위치 변화",
	"hand-face": "손목이 얼굴 영역과 겹침",
};
export function cameraAdvice(
	kind: CameraEventKind,
	reference: CameraSettings["reference"],
): string {
	switch (kind) {
		case "head-away":
			return reference === "closed"
				? "메모를 확인한 구간인지 돌아보세요. 다음에는 핵심어를 정리한 뒤 자료 없이 답해 보세요."
				: "질문이나 자료를 확인한 움직임일 수 있어요. 화면과 카메라의 높이를 가깝게 맞춰 보세요.";
		case "eyes-away":
			return "눈 좌표로 추정한 변화입니다. 실제로 글을 읽었는지는 알 수 없어요. 자막·질문 위치와 안경 반사를 확인해 보세요.";
		case "face-missing":
			return "화면 이탈·가림·조명 때문에 측정하지 못할 수 있어요. 얼굴이 화면 안에 들어오는지 확인해 주세요.";
		case "multiple-faces":
			return "여러 얼굴이 감지된 구간은 자세 측정에서 제외했어요. 배경의 사진이나 다른 사람이 잡혔는지 확인해 주세요.";
		case "body-shift":
			return "어깨 위치가 기준 자세에서 달라졌어요. 설명을 위한 자연스러운 움직임인지 돌아보세요.";
		case "hand-face":
			return "손목 좌표가 얼굴 영역과 겹쳤어요. 실제 가림 여부는 알 수 없으니 손의 위치를 돌아보세요.";
	}
}
export function cameraTime(value: number): string {
	return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}
export class CameraAccumulator {
	private total = 0;
	private face = 0;
	private pose = 0;
	private events: CameraEvent[] = [];
	private open = new Map<CameraEventKind, CameraEvent>();
	private previous: number | null = null;
	private answer = 1;
	private truncated = false;
	constructor(
		readonly settings: CameraSettings,
		private baseline: Baseline,
	) {}
	updateBaseline(baseline: Baseline) {
		this.boundary();
		this.baseline = baseline;
	}
	boundary() {
		this.flush();
		this.previous = null;
	}
	private save(event: CameraEvent) {
		if (event.end - event.start < (event.kind === "hand-face" ? 2 : 3)) return;
		if (this.events.length < 80) this.events.push({ ...event });
		else this.truncated = true;
	}
	private flush() {
		for (const event of this.open.values()) this.save(event);
		this.open.clear();
	}
	sample(frame: CameraFrame, time: number, answer: number) {
		if (!Number.isFinite(time) || time < 0 || this.total >= 1800) {
			this.boundary();
			return;
		}
		if (
			this.previous !== null &&
			(time - this.previous > 0.6 ||
				time < this.previous ||
				answer !== this.answer)
		)
			this.boundary();
		const delta =
			this.previous === null ? 0 : Math.min(0.4, time - this.previous);
		this.previous = time;
		this.answer = answer;
		this.total += delta;
		const value = features(frame);
		if (value) {
			this.face += delta;
			if (value.bodyX !== null) this.pose += delta;
		}
		const kinds = classify(frame, this.baseline);
		for (const [kind, event] of this.open) {
			if (!kinds.includes(kind)) {
				this.save(event);
				this.open.delete(kind);
			}
		}
		for (const kind of kinds) {
			const event = this.open.get(kind);
			if (event) event.end = time;
			else this.open.set(kind, { kind, start: time, end: time, answer });
		}
	}
	snapshot(): CameraAnalysis {
		const round = (v: number) => Math.round(v * 10) / 10;
		const pending = [...this.open.values()].filter(
			(e) => e.end - e.start >= (e.kind === "hand-face" ? 2 : 3),
		);
		return {
			version: 1,
			settings: { ...this.settings },
			sampledSeconds: round(this.total),
			faceSeconds: round(this.face),
			poseSeconds: round(this.pose),
			sufficient: this.face >= 10 && this.face / Math.max(1, this.total) >= 0.6,
			calibrated: true,
			events: [...this.events, ...pending]
				.slice(0, 80)
				.sort((a, b) => a.start - b.start)
				.map((e) => ({ ...e, start: round(e.start), end: round(e.end) })),
			truncated: this.truncated || this.events.length + pending.length > 80,
		};
	}
}
