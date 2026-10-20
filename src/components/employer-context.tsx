import type { InterviewContext, QuestionSource } from "@/lib/interview-context";
import { sourceLabels } from "@/lib/interview-context";
import { EmployerField, type EmployerUpdate } from "./employer-field";

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
	onPending,
	disabled,
}: {
	readonly value: InterviewContext;
	readonly onChange: (update: EmployerUpdate) => void;
	readonly disabled: boolean;
	readonly onPending: (key: string, pending: boolean) => void;
}) {
	return (
		<section className="employer-fields">
			<h3>
				기업에 맞춘 질문 준비 <span className="tag">선택</span>
			</h3>
			<p className="context-hint">
				공식 채용 페이지의 URL에서 내용을 가져와 확인해 주세요. 수집이 안 되거나
				직접 적으려면 수동 입력을 선택하세요. 각 자료는 선택 사항이에요.
			</p>
			{fields.map((field) => (
				<EmployerField
					key={field.key}
					field={field}
					value={value[field.key]}
					sourceUrl={value.sourceUrls?.[field.key]}
					disabled={disabled}
					onPending={(pending) => onPending(field.key, pending)}
					onChange={(text, url) =>
						onChange((previous) => ({
							...previous,
							[field.key]: text,
							sourceUrls: { ...previous.sourceUrls, [field.key]: url },
						}))
					}
				/>
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
				확인한 자료를 텍스트·음성 질문과 피드백에 함께 전달해요.
			</p>
			{supplied.map((field) => (
				<details key={field.key}>
					<summary>{field.label}</summary>
					<p className="material-text">{context[field.key]}</p>
					{context.sourceUrls?.[field.key] && (
						<a
							href={context.sourceUrls[field.key]}
							target="_blank"
							rel="noopener noreferrer"
						>
							참고 URL 열기
						</a>
					)}
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
