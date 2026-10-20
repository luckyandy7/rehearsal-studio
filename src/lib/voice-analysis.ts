import { z } from "zod";

const metric = z.number().finite();
export const voiceAnalysisSchema = z.object({
	source: z.literal("microphone"),
	analysedSeconds: metric.min(0).max(1801),
	voicedSeconds: metric.min(0).max(1801),
	pauseCount: z.number().int().min(0),
	longestPauseSeconds: metric.min(0),
	volumeLowDb: metric,
	volumeHighDb: metric,
	clippingPercent: metric.min(0).max(100),
	pitchLowHz: metric.nullable(),
	pitchHighHz: metric.nullable(),
	transcriptCharacters: z.number().int().min(0),
	fillerCount: z.number().int().min(0),
	charactersPerMinute: metric.nullable(),
	sufficient: z.boolean(),
});
export type VoiceAnalysis = z.infer<typeof voiceAnalysisSchema>;
const percentile = (values: readonly number[], fraction: number): number => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor((sorted.length - 1) * fraction)] ?? 0;
};
export function pitchHz(
	samples: Float32Array,
	sampleRate: number,
): number | null {
	const step = Math.max(1, Math.floor(sampleRate / 12000));
	const rate = sampleRate / step;
	const data = Array.from(
		{ length: Math.floor(samples.length / step) },
		(_, i) => samples[i * step] ?? 0,
	);
	const mean = data.reduce((a, b) => a + b, 0) / data.length;
	let best = 0;
	const correlations: number[] = [];
	const minimumLag = Math.floor(rate / 400);
	for (
		let offset = minimumLag - 1;
		offset <= Math.ceil(rate / 75) + 1;
		offset++
	) {
		let cross = 0,
			left = 0,
			right = 0;
		for (let i = 0; i < data.length - offset; i++) {
			const a = (data[i] ?? 0) - mean;
			const b = (data[i + offset] ?? 0) - mean;
			cross += a * b;
			left += a * a;
			right += b * b;
		}
		const correlation = cross / Math.sqrt(left * right || 1);
		correlations[offset] = correlation;
		best = Math.max(best, correlation);
	}
	// Prefer the first strong local peak, not a later multiple of the period.
	for (let lag = minimumLag; lag <= Math.ceil(rate / 75); lag++) {
		const peak = correlations[lag] ?? 0;
		const before = correlations[lag - 1] ?? 0;
		const after = correlations[lag + 1] ?? 0;
		if (peak > 0.75 && peak >= best * 0.95 && peak > before && peak >= after) {
			const curve = before - 2 * peak + after;
			const adjustment = curve ? (before - after) / (2 * curve) : 0;
			return rate / (lag + adjustment);
		}
	}
	return null;
}
// Mutable accumulator belongs to one microphone measurement, never to React render state.
export class VoiceMeter {
	private seconds = 0;
	private voiced = 0;
	private pendingSilence = 0;
	private pauses = 0;
	private longest = 0;
	private clipped = 0;
	private sampleCount = 0;
	private volumes: number[] = [];
	private pitches: number[] = [];
	private transcript = "";
	addTranscript(text: string): void {
		this.transcript = (this.transcript + " " + text).slice(0, 30000);
	}
	add(samples: Float32Array, sampleRate: number, deltaSeconds: number): void {
		if (this.seconds >= 1800) return;
		const delta = Math.min(
			0.25,
			Math.max(0, deltaSeconds),
			1800 - this.seconds,
		);
		this.seconds += delta;
		let energy = 0;
		for (const sample of samples) {
			energy += sample * sample;
			if (Math.abs(sample) >= 0.98) this.clipped++;
		}
		this.sampleCount += samples.length;
		const rms = Math.sqrt(energy / Math.max(1, samples.length));
		if (rms < 0.012) {
			if (this.voiced > 0) this.pendingSilence += delta;
			return;
		}
		if (this.pendingSilence >= 1.5) {
			this.pauses++;
			this.longest = Math.max(this.longest, this.pendingSilence);
		}
		this.pendingSilence = 0;
		this.voiced += delta;
		this.volumes.push(20 * Math.log10(Math.max(rms, 0.00001)));
		const pitch = pitchHz(samples, sampleRate);
		if (pitch) this.pitches.push(pitch);
	}
	snapshot(): VoiceAnalysis {
		const characters = (this.transcript.match(/[가-힣A-Za-z0-9]/g) ?? [])
			.length;
		const fillers = (
			this.transcript.match(
				/(?:^|[\s,.!?])(?:음+|어+|저기|그러니까)(?=$|[\s,.!?])/g,
			) ?? []
		).length;
		const round = (value: number) => Math.round(value * 10) / 10;
		return {
			source: "microphone",
			analysedSeconds: round(this.seconds),
			voicedSeconds: round(this.voiced),
			pauseCount: this.pauses,
			longestPauseSeconds: round(this.longest),
			volumeLowDb: round(percentile(this.volumes, 0.1)),
			volumeHighDb: round(percentile(this.volumes, 0.9)),
			clippingPercent: round(
				(this.clipped / Math.max(1, this.sampleCount)) * 100,
			),
			pitchLowHz:
				this.pitches.length >= 10 ? round(percentile(this.pitches, 0.1)) : null,
			pitchHighHz:
				this.pitches.length >= 10 ? round(percentile(this.pitches, 0.9)) : null,
			transcriptCharacters: characters,
			fillerCount: fillers,
			charactersPerMinute:
				characters && this.voiced >= 3
					? Math.round((characters / this.voiced) * 60)
					: null,
			sufficient: this.seconds >= 5 && this.voiced >= 3,
		};
	}
}
export function voiceSuggestions(
	analysis: VoiceAnalysis,
): { observation: string; suggestion: string }[] {
	if (!analysis.sufficient)
		return [
			{
				observation:
					"말소리로 추정된 구간이 충분하지 않아 톤을 해석하기 어려워요.",
				suggestion:
					"조용한 곳에서 마이크와 거리를 유지하고 10초 이상 말한 뒤 다시 측정해 보세요.",
			},
		];
	const result = [];
	if (analysis.pauseCount)
		result.push({
			observation: `말소리 사이 1.5초 이상 조용한 구간이 ${analysis.pauseCount}회 있었어요. 가장 긴 구간은 ${analysis.longestPauseSeconds}초예요.`,
			suggestion:
				"의도한 문장 사이의 쉼인지 확인해 보세요. 문장 중간에 막혔다면 결론 → 행동 → 결과 순서로 핵심어를 메모하고 다시 말해 보세요.",
		});
	if (analysis.clippingPercent > 0.5)
		result.push({
			observation: `측정 샘플의 ${analysis.clippingPercent}%가 디지털 최대 음량에 가까웠어요.`,
			suggestion:
				"소리가 찌그러질 수 있으니 마이크 입력 감도를 낮추거나 조금 떨어져 말해 보세요.",
		});
	else
		result.push({
			observation: `말소리 음량의 중간 80% 범위는 ${analysis.volumeLowDb}~${analysis.volumeHighDb} dBFS예요.`,
			suggestion:
				analysis.volumeHighDb - analysis.volumeLowDb > 18
					? "마이크 거리가 달라지거나 음량 변화가 큰지 확인하고, 결론 문장까지 일정한 거리에서 말해 보세요."
					: "현재 마이크 거리를 유지하며 중요한 단어를 또렷하게 말하는 연습을 해 보세요.",
		});
	if (analysis.pitchLowHz && analysis.pitchHighHz) {
		const semitones =
			12 * Math.log2(analysis.pitchHighHz / analysis.pitchLowHz);
		result.push({
			observation: `검출된 음높이의 중간 80% 범위는 ${analysis.pitchLowHz}~${analysis.pitchHighHz} Hz예요.`,
			suggestion:
				semitones < 3
					? "강조하려는 핵심 단어에서 높낮이나 쉼을 조금 달리해 보세요. 문장과 목소리에 따라 편안한 범위는 달라요."
					: "핵심 단어에 강조가 모이는지 확인해 보세요. 음높이를 크게 바꾸는 것 자체가 목표는 아니에요.",
		});
	}
	if (analysis.transcriptCharacters)
		result.push({
			observation: `이 측정 중 받은 자막에서 “음·어·저기·그러니까”가 ${analysis.fillerCount}회 나타났어요.`,
			suggestion:
				"자막 인식 오류와 실제 표현을 구분해 보세요. 반복이 신경 쓰이면 표현을 채우는 대신 짧게 쉬었다가 다음 문장을 시작해 보세요.",
		});
	return result;
}
