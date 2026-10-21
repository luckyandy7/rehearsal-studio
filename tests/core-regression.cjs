const assert = require("node:assert/strict");
const fs = require("node:fs");
const { transformSync } = require("next/dist/build/swc");
const { zipSync, strToU8 } = require("fflate");
require.extensions[".ts"] = (module, file) =>
	module._compile(
		transformSync(fs.readFileSync(file, "utf8"), {
			filename: file,
			jsc: { parser: { syntax: "typescript" }, target: "es2022" },
			module: { type: "commonjs" },
		}).code,
		file,
	);
const { pitchHz, VoiceMeter } = require("../src/lib/voice-analysis.ts");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const post = (path, data) =>
	fetch(base + path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(data),
	});
const upload = (name, bytes) => {
	const data = new FormData();
	data.set("file", new File([bytes], name));
	return fetch(base + "/api/extract", { method: "POST", body: data });
};
function pdf() {
	const text = "BT /F1 18 Tf 50 700 Td (Rehearsal PDF test) Tj ET";
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
	];
	let body = "%PDF-1.4\n";
	const offsets = [0];
	objects.forEach((o, i) => {
		offsets.push(Buffer.byteLength(body));
		body += `${i + 1} 0 obj\n${o}\nendobj\n`;
	});
	const xref = Buffer.byteLength(body);
	body +=
		"xref\n0 6\n0000000000 65535 f \n" +
		offsets
			.slice(1)
			.map((v) => `${String(v).padStart(10, "0")} 00000 n \n`)
			.join("") +
		`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return Buffer.from(body);
}
(async () => {
	for (const rate of [44100, 48000])
		for (const hz of [80, 100, 160, 220, 300, 390]) {
			const wave = Float32Array.from(
				{ length: 4096 },
				(_, i) => 0.15 * Math.sin((2 * Math.PI * hz * i) / rate),
			);
			assert.ok(Math.abs(pitchHz(wave, rate) - hz) < 3, `${rate}/${hz}`);
		}
	const meter = new VoiceMeter(),
		silence = new Float32Array(4096),
		wave = Float32Array.from(
			{ length: 4096 },
			(_, i) => 0.15 * Math.sin((2 * Math.PI * 180 * i) / 48000),
		);
	for (let i = 0; i < 40; i++) meter.add(wave, 48000, 0.1);
	for (let i = 0; i < 20; i++) meter.add(silence, 48000, 0.1);
	for (let i = 0; i < 20; i++) meter.add(wave, 48000, 0.1);
	meter.addTranscript("음 저는 직접 테스트했습니다.");
	assert.equal(meter.snapshot().pauseCount, 1);
	assert.equal(meter.snapshot().fillerCount, 1);
	assert.equal(meter.snapshot().sufficient, true);
	const quiet = new VoiceMeter();
	for (let i = 0; i < 100; i++) quiet.add(silence, 48000, 0.1);
	assert.equal(quiet.snapshot().sufficient, false);
	assert.equal(quiet.snapshot().pitchLowHz, null);
	const docx = zipSync({
		"[Content_Types].xml": strToU8(
			'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
		),
		"word/document.xml": strToU8(
			'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Rehearsal DOCX test</w:t></w:r></w:p></w:body></w:document>',
		),
	});
	const pptx = zipSync({
		"ppt/slides/slide2.xml": strToU8("<a:t>Second slide</a:t>"),
		"ppt/slides/slide1.xml": strToU8("<a:t>First slide</a:t>"),
	});
	for (const [name, data, expected] of [
		["sample.txt", Buffer.from("자기소개서 테스트입니다."), "자기소개서"],
		["sample.docx", docx, "DOCX"],
		["sample.pptx", pptx, "First slide"],
		["sample.pdf", pdf(), "PDF test"],
	]) {
		const response = await upload(name, data);
		assert.equal(response.status, 200, name);
		const result = await response.json();
		assert.ok(result.text.includes(expected), name);
		if (name.endsWith("pptx"))
			assert.ok(result.text.indexOf("First") < result.text.indexOf("Second"));
	}
	assert.equal((await upload("bad.pdf", Buffer.from("not a pdf"))).status, 422);
	assert.equal((await upload("bad.exe", Buffer.from("invalid"))).status, 415);
	assert.equal(
		(await upload("large.txt", Buffer.from("x".repeat(30001)))).status,
		413,
	);
	for (const url of [
		"http://127.0.0.1",
		"http://[::1]",
		"http://2130706433",
		"http://169.254.169.254",
		"file:///etc/passwd",
	]) {
		const r = await post("/api/import-url", { url, kind: "jobPosting" });
		assert.ok(r.status >= 400 && r.status < 500, `${url}: ${r.status}`);
	}
	const cross = await fetch(base + "/api/import-url", {
		method: "POST",
		headers: {
			origin: "https://invalid.example",
			"content-type": "application/json",
		},
		body: JSON.stringify({ url: "https://example.com", kind: "companyInfo" }),
	});
	assert.equal(cross.status, 403);
	for (const hostname of ["127.0.0.1", "localhost"]) {
		const destination = new URL(base);
		destination.hostname = hostname;
		for (const [origin, site, expected] of [
			[destination.origin, "same-origin", 400],
			[destination.origin, "cross-site", 403],
			[`${destination.protocol}//${hostname}:9999`, "same-site", 403],
			["null", "same-origin", 403],
		]) {
			const response = await fetch(new URL("/api/report", destination), {
				method: "POST",
				headers: {
					origin,
					"sec-fetch-site": site,
					"content-type": "application/json",
				},
				body: "{}",
			});
			assert.equal(
				response.status,
				expected,
				`${destination.origin}: ${origin}/${site}`,
			);
		}
	}
	const imported = await post("/api/import-url", {
		url: "https://example.com",
		kind: "companyInfo",
	});
	assert.equal(imported.status, 200, await imported.clone().text());
	const importedBody = await imported.json();
	assert.equal(importedBody.title, "Example Domain");
	assert.ok(importedBody.text.includes("documentation examples"));
	const noAnswer = await post("/api/report", {
		mode: "interview",
		material: "테스트 자료",
		role: "개발자",
		difficulty: "normal",
		messages: [],
	});
	assert.equal(noAnswer.status, 400);
	console.log(
		"PASS: pitch/silence/pause/fillers; TXT/DOCX/PPTX/PDF; invalid/oversized files; private URLs; origin guard; live public URL import; empty-report rejection.",
	);
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
