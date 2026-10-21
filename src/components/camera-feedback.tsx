import {
	type CameraAnalysis,
	cameraAdvice,
	cameraLabels,
	cameraTime,
} from "@/lib/camera-analysis";
import type { Message } from "@/lib/types";
import "./camera.css";
export function CameraFeedback({
	analysis,
	messages,
}: {
	analysis: CameraAnalysis | undefined;
	messages: Message[];
}) {
	if (!analysis)
		return (
			<section className="form-panel">
				<h2>시선·자세 분석을 사용하지 않았어요</h2>
				<p>
					다음 연습의 입장 안내에서 카메라를 켜고 기준 자세를 보정해 보세요.
				</p>
			</section>
		);
	const coverage = analysis.sampledSeconds
		? Math.round((analysis.faceSeconds / analysis.sampledSeconds) * 100)
		: 0;
	const questions: string[] = [];
	let last = "질문 전 답변";
	for (const m of messages) {
		if (m.role === "assistant") last = m.content;
		else questions.push(last);
	}
	return (
		<section className="form-panel camera-feedback">
			<span className="eyebrow">CAMERA REVIEW · 기기 내 측정</span>
			<h2>시선과 자세를 돌아보세요</h2>
			<p>
				얼굴 방향·눈·어깨·손목 좌표로 추정한 관찰입니다. 글 읽기, 부정행위,
				감정이나 채용 적합성을 판정하지 않아요.
			</p>
			<dl className="camera-metrics">
				<div>
					<dt>답변 측정 시간</dt>
					<dd>{analysis.sampledSeconds}초</dd>
				</div>
				<div>
					<dt>얼굴 측정 가능 비율</dt>
					<dd>{coverage}%</dd>
				</div>
				<div>
					<dt>상체 측정 시간</dt>
					<dd>{analysis.poseSeconds}초</dd>
				</div>
			</dl>
			<p className="context-hint">
				{analysis.settings.reference === "allowed"
					? "자료 참조 허용"
					: "자료 없이 연습"}{" "}
				·{" "}
				{analysis.settings.shareSummary
					? "OpenAI 모드에서는 요약 공유를 선택했어요."
					: "카메라 요약을 OpenAI에 보내지 않았어요."}{" "}
				비율은 실력 점수가 아닙니다.
			</p>
			{!analysis.sufficient && (
				<p className="camera-coaching" role="status">
					측정 부족 · 얼굴이 보이는 답변이 10초 이상이고 측정 가능 비율이 60%
					이상일 때 종합적으로 돌아볼 수 있어요. 아래 구간은 제한적인
					관찰입니다.
				</p>
			)}
			<h3>확인할 구간</h3>
			<p className="context-hint">
				시간은 연습방 입장 이후 기준입니다. 원본 영상은 보관하지 않아 재생
				기능은 없어요. 음성은 감지된 발화, 텍스트는 직접 켠 측정 구간만
				포함합니다.
			</p>
			{!analysis.events.length ? (
				<p>
					{analysis.sufficient
						? "설정된 지속 시간 기준에 해당하는 구간이 없었어요. 자세가 완벽하다는 의미는 아닙니다."
						: "확인할 구간이 충분히 쌓이지 않았어요. 다음 연습에서 측정해 보세요."}
				</p>
			) : (
				<ol className="camera-timeline">
					{analysis.events.map((e, i) => (
						<li key={`${e.kind}-${e.start}-${i}`}>
							<span className="camera-time">
								{cameraTime(e.start)}–{cameraTime(e.end)} · 답변 {e.answer}
							</span>
							<h4>{cameraLabels[e.kind]}</h4>
							<p>{cameraAdvice(e.kind, analysis.settings.reference)}</p>
							<details>
								<summary>연결된 질문 보기</summary>
								<p>
									{questions[e.answer - 1] ??
										"이 구간의 답변 자막이 완성되지 않아 질문을 연결하지 못했어요."}
								</p>
							</details>
						</li>
					))}
				</ol>
			)}
			{analysis.truncated && (
				<p>기록 용량을 위해 처음 80개 구간만 저장했어요.</p>
			)}
		</section>
	);
}
