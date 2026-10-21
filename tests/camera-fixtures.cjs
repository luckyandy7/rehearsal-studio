const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
async function setup(page, mode = "면접") {
	await page.route("**/api/status", (r) =>
		r.fulfill({ json: { configured: true } }),
	);
	await page.goto(base);
	await page.waitForTimeout(800);
	await page.getByRole("button", { name: mode + " 연습", exact: true }).click();
	await page.getByRole("button", { name: "예시 불러오기" }).click();
	await page.getByRole("button", { name: "리허설 시작", exact: false }).click();
}
function mockCamera() {
	window.__tracks = [];
	const original = navigator.mediaDevices.getUserMedia.bind(
		navigator.mediaDevices,
	);
	navigator.mediaDevices.getUserMedia = async (options) => {
		const media = await original(options);
		window.__tracks.push(...media.getTracks());
		return media;
	};
	window.__frameKind = "normal";
	window.__workers = [];
	window.Worker = class {
		constructor() {
			window.__workers.push(this);
			this.terminated = false;
		}
		terminate() {
			this.terminated = true;
		}
		postMessage(data) {
			if (this.terminated) return;
			if (data.type === "init") {
				setTimeout(() => {
					if (!this.terminated) this.onmessage?.({ data: { type: "ready" } });
				}, 10);
				return;
			}
			data.bitmap.close();
			const f = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
			const set = (i, x, y) => (f[i] = { x, y });
			set(234, 0.25, 0.5);
			set(454, 0.75, 0.5);
			set(1, window.__frameKind === "away" ? 0.7 : 0.5, 0.5);
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
			setTimeout(() => {
				if (!this.terminated)
					this.onmessage?.({
						data: {
							type: "frame",
							frame: {
								faces: window.__frameKind === "missing" ? [] : [f],
								pose,
							},
							time: data.time,
						},
					});
			}, 10);
		}
	};
}
async function calibrate(page) {
	await page.getByRole("button", { name: "카메라 켜기", exact: true }).click();
	await page.getByRole("button", { name: "기준 자세 보정 · 10초" }).click();
	await page
		.getByText("보정 완료 · 입장 후 답변 구간을 측정해요.")
		.waitFor({ timeout: 20000 });
}

module.exports = { setup, mockCamera, calibrate };
