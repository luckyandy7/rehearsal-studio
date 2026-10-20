import { type VoiceAnalysis, voiceSuggestions } from "@/lib/voice-analysis";
export function VoiceFeedback({
	analysis,
}: {
	readonly analysis: VoiceAnalysis | undefined;
}) {
	if (!analysis)
		return (
			<p className="context-hint">
				마이크 말하기 분석을 마치면 음량·높낮이·쉼을 근거로 연습 방법을 확인할
				수 있어요. 텍스트만 입력한 답변에는 음성 수치를 만들지 않아요.
			</p>
		);
	return (
		<section className="voice-feedback">
			<h3>말하기 분석 피드백</h3>
			<p className="context-hint">
				가장 최근 마이크 측정 · {analysis.analysedSeconds}초. 기기와 주변 소음에
				영향을 받는 참고 수치입니다. 성격·감정·합격 가능성을 판단하지 않아요.
			</p>
			{analysis.sufficient && (
				<dl className="voice-metrics">
					<div>
						<dt>말소리 추정 구간</dt>
						<dd>{analysis.voicedSeconds}초</dd>
					</div>
					<div>
						<dt>1.5초 이상 쉼</dt>
						<dd>{analysis.pauseCount}회</dd>
					</div>
					<div>
						<dt>음량 범위 (dBFS)</dt>
						<dd>
							{analysis.volumeLowDb}~{analysis.volumeHighDb}
						</dd>
					</div>
					<div>
						<dt>음높이 범위 (Hz)</dt>
						<dd>
							{analysis.pitchLowHz && analysis.pitchHighHz
								? `${analysis.pitchLowHz}~${analysis.pitchHighHz}`
								: "검출 부족"}
						</dd>
					</div>
					<div>
						<dt>발화 구간 기준 글자/분</dt>
						<dd>{analysis.charactersPerMinute ?? "자막 없음"}</dd>
					</div>
				</dl>
			)}
			<ul className="voice-advice">
				{voiceSuggestions(analysis).map((item) => (
					<li key={item.observation}>
						<strong>{item.observation}</strong>
						<p>{item.suggestion}</p>
					</li>
				))}
			</ul>
			<p className="context-hint">
				음량·높낮이는 극단값을 제외한 10~90백분위 범위입니다. 쉼은 처음·마지막의
				무음을 제외한 신호 기준 추정이며, 생각하는 시간도 포함될 수 있어요.
				속도·반복 표현은 같은 측정 중 받은 음성 자막이 있을 때만 계산합니다.
			</p>
		</section>
	);
}
