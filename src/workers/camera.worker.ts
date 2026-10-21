import {
	FaceLandmarker,
	FilesetResolver,
	PoseLandmarker,
} from "@mediapipe/tasks-vision";
import type { CameraFrame } from "../lib/camera-analysis";

let face: FaceLandmarker | null = null;
let pose: PoseLandmarker | null = null;
self.onmessage = async (
	event: MessageEvent<
		| { type: "init"; base: string }
		| { type: "frame"; bitmap: ImageBitmap; time: number }
	>,
) => {
	const data = event.data;
	try {
		if (data.type === "init") {
			const files = await FilesetResolver.forVisionTasks(`${data.base}/wasm`);
			face = await FaceLandmarker.createFromOptions(files, {
				baseOptions: {
					modelAssetPath: `${data.base}/face.task`,
					delegate: "CPU",
				},
				runningMode: "VIDEO",
				numFaces: 2,
				minFaceDetectionConfidence: 0.6,
				minFacePresenceConfidence: 0.6,
				minTrackingConfidence: 0.6,
			});
			pose = await PoseLandmarker.createFromOptions(files, {
				baseOptions: {
					modelAssetPath: `${data.base}/pose.task`,
					delegate: "CPU",
				},
				runningMode: "VIDEO",
				numPoses: 1,
				minPoseDetectionConfidence: 0.6,
				minPosePresenceConfidence: 0.6,
				minTrackingConfidence: 0.6,
			});
			self.postMessage({ type: "ready" });
		} else {
			if (!face || !pose) throw new Error("not ready");
			const result: CameraFrame = {
				faces: face.detectForVideo(data.bitmap, data.time).faceLandmarks,
				pose: pose.detectForVideo(data.bitmap, data.time).landmarks[0] ?? [],
			};
			self.postMessage({ type: "frame", frame: result, time: data.time });
		}
	} catch {
		self.postMessage({ type: "error" });
	} finally {
		if (data.type === "frame") data.bitmap.close();
	}
};
