import type { InterviewContext, QuestionSource } from "@/lib/interview-context";
import { sourceLabels } from "@/lib/interview-context";

const fields = [
	{
		key: "jobPosting",
		label: "채용공고",
		limit: 8000,
		placeholder: "담당 업무, 필수 자격, 우대 사항을 붙여 넣어 주세요.",
	},
	{
		key: "companyInfo",
		label: "기업 정보",
		limit: 4000,
		placeholder:
			"기업명, 주요 서비스, 사업 방향 등 공식 자료에서 확인한 내용을 적어 주세요.",
	},
	{
		key: "companyValues",
		label: "기업 가치관·인재상",
		limit: 4000,
		placeholder:
			"고객 중심, 협업 등 기업이 강조하는 가치와 구체적인 설명을 붙여 넣어 주세요.",
	},
] as const;
export function EmployerFields({
	value,
	onChange,
	disabled,
}: {
	readonly value: InterviewContext;
	readonly onChange: (value: InterviewContext) => void;
	readonly disabled: boolean;
}) {
	return (
		<section className="employer-fields">
			<h3>
				기업에 맞춘 질문 준비 <span className="tag">선택</span>
			</h3>
			<p className="context-hint">
				공고의 요구 역량과 기업 가치를 내 경험에 연결해 질문해요. 공식 채용
				페이지의 내용을 복사해 주세요. URL 자동 수집은 지원하지 않아요.
			</p>
			{fields.map((field) => (
				<div key={field.key}>
					<label className="field-label" htmlFor={field.key}>
						{field.label}
					</label>
					<textarea
						id={field.key}
						rows={4}
						maxLength={field.limit}
						value={value[field.key]}
						disabled={disabled}
						placeholder={field.placeholder}
						onChange={(event) =>
							onChange({ ...value, [field.key]: event.target.value })
						}
						aria-describedby={`${field.key}-count`}
					/>
					<small id={`${field.key}-count`} className="context-count">
						{value[field.key].length.toLocaleString()} /{" "}
						{field.limit.toLocaleString()}
					</small>
				</div>
			))}
		</section>
	);
}
export function EmployerMaterials({
	context,
}: {
	readonly context: InterviewContext;
}) {
	const supplied = fields.filter((field) => context[field.key]);
	if (!supplied.length) return null;
	return (
		<section className="form-panel employer-materials">
			<h2>이번 면접의 기업 자료</h2>
			<p className="context-hint">
				직접 제공한 자료입니다. 텍스트·음성 질문과 피드백에 함께 전달해요.
			</p>
			{supplied.map((field) => (
				<details key={field.key}>
					<summary>{field.label}</summary>
					<p className="material-text">{context[field.key]}</p>
				</details>
			))}
		</section>
	);
}
export function QuestionSources({
	sources,
}: {
	readonly sources: readonly QuestionSource[] | undefined;
}) {
	if (!sources?.length) return null;
	return (
		<details className="question-sources">
			<summary>질문에 사용한 자료 · {sources.length}</summary>
			{sources.map((source) => (
				<div key={`${source.kind}-${source.quote}`}>
					<strong>{sourceLabels[source.kind]}</strong>
					<blockquote>{source.quote}</blockquote>
				</div>
			))}
		</details>
	);
}
