import { createHash } from "node:crypto";
import { readFile, mkdir, cp, writeFile, rename } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const root = new URL("../public/camera-assets/", import.meta.url);
await mkdir(root, { recursive: true });
await cp(
	join(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm"),
	new URL("wasm/", root),
	{ recursive: true },
);
const assets = JSON.parse(
	await readFile(new URL("./camera-assets.json", import.meta.url), "utf8"),
);
for (const asset of assets) {
	const target = new URL(asset.file, root);
	const hash = (data) => createHash("sha256").update(data).digest("hex");
	let cached;
	try {
		cached = await readFile(target);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	if (cached && hash(cached) === asset.sha256) continue;
	const response = await fetch(asset.url, {
		signal: AbortSignal.timeout(60000),
	});
	if (!response.ok)
		throw new Error(`Camera model download failed: ${response.status}`);
	const data = Buffer.from(await response.arrayBuffer());
	if (hash(data) !== asset.sha256)
		throw new Error(`Camera model checksum mismatch: ${asset.file}`);
	const temp = new URL(asset.file + ".tmp", root);
	await writeFile(temp, data);
	await rename(temp, target);
}
console.log("Camera models and WASM ready (local assets, checksums verified).");
