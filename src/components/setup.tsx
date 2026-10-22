"use client";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle,
	FileText,
	ShieldCheck,
	UploadSimple,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import {
	emptyInterviewContext,
	type InterviewContext,
} from "@/lib/interview-context";
import {
	configSchema,
	type Mode,
	modeLabels,
	type SessionConfig,
} from "@/lib/types";
import { EmployerFields } from "./employer-context";
import "./screens.css";

const examples: Record<Mode, string> = {
	interview:
		"저는 사용자 문제를 해결하는 프론트엔드 개발자를 지망합니다. 교내 팀 프로젝트에서 일정 관리 서비스를 만들며 React 기반 화면 개발을 담당했습니다. 사용자 12명과 인터뷰한 결과 일정 입력 과정이 복잡하다는 피드백을 받았습니다. 입력 단계를 5단계에서 3단계로 줄이고 팀원들과 사용성 테스트를 진행했습니다. 일정이 촉박한 상황에서 기능 우선순위를 조율한 경험을 통해 협업의 중요성을 배웠습니다.",
	presentation:
		"발표 주제: 대학생을 위한 공유 물품 대여 서비스. 문제: 기숙사 학생들은 일 년에 몇 번 쓰지 않는 공구와 생활용품을 각자 구매합니다. 해결책: 학교 인증을 거친 학생들이 필요한 물품을 가까운 사람에게 빌릴 수 있는 서비스입니다. 핵심 기능은 물품 등록, 대여 일정 관리, 거래 후 평가입니다. 초기에는 교내 동아리 3곳과 시범 운영하여 대여 완료율과 재사용률을 측정합니다. 주요 위험은 물품 파손과 미반납이며, 보증금과 대여 전후 상태 확인으로 대응할 계획입니다.",
};
type Props = {
	readonly mode: Mode;
	readonly onBack: () => void;
	readonly onStart: (config: SessionConfig) => void;
};
export function Setup({ mode, onBack, onStart }: Props) {
	const [interviewContext, setInterviewContext] = useState<InterviewContext>(
		emptyInterviewContext,
	);
	const [material, setMaterial] = useState("");
	const [role, setRole] = useState(
		mode === "interview" ? "신입 프론트엔드 개발자" : "교내 ICT 경진대회",
	);
	const [difficulty, setDifficulty] =
		useState<SessionConfig["difficulty"]>("normal");
	const [durationMinutes, setDuration] = useState(5);
	const [practiceStyle, setPracticeStyle] =
		useState<SessionConfig["practiceStyle"]>("coaching");
	const [provider, setProvider] = useState<SessionConfig["provider"]>("openai");
	const [fileName, setFileName] = useState("");
	const [configured, setConfigured] = useState<boolean | null>(null);
	const [statusError, setStatusError] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [importingFields, setImportingFields] = useState<
		Record<string, boolean>
	>({});
	const importing = Object.values(importingFields).some(Boolean);
	const uploadRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		const controller = new AbortController();
		void api
			.get("/api/status", { signal: controller.signal })
			.json<unknown>()
			.then((value) => {
				setConfigured(
					z.object({ configured: z.boolean() }).parse(value).configured,
				);
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setStatusError(
						"AI 연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
					);
			});
		return () => controller.abort();
	}, []);
	async function upload(file: File) {
		setError("");
		if (file.size > 10 * 1024 * 1024) {
			setError("10MB 이하 파일을 선택해 주세요.");
			return;
		}
		setBusy(true);
		try {
			const body = new FormData();
			body.append("file", file);
			const result = z
				.object({ text: z.string(), name: z.string() })
				.parse(await api.post("/api/extract", { body }).json<unknown>());
			setMaterial(result.text);
			setFileName(result.name);
		} catch (cause) {
			setError(await errorMessage(cause));
		} finally {
			setBusy(false);
		}
	}
	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy || importing) return;
		setError("");
		const parsed = configSchema.safeParse({
			mode,
			material: material.trim(),
			role: role.trim(),
			difficulty,
			durationMinutes,
			practiceStyle,
			provider,
			fileName,
			interviewContext:
				mode === "interview" ? interviewContext : emptyInterviewContext,
		});
		if (!parsed.success) {
			setError(
				"자료는 20~30,000자, 목표는 1~160자, 연습 시간은 1~30분으로 입력해 주세요. 기업 자료는 각 입력란의 글자 수 제한을 확인해 주세요.",
			);
			return;
		}
		if (provider === "openai" && configured !== true) {
			setError("OpenAI 연결을 확인한 후 시작하거나 데모 체험을 선택해 주세요.");
			return;
		}
		onStart(parsed.data);
	}
	return (
		<div className="screen-stack">
			<Button variant="ghost" className="back-action" onClick={onBack}>
				<ArrowLeft /> 돌아가기
			</Button>
			<header className="screen-heading compact">
				<span className="eyebrow">PREPARE YOUR SESSION</span>
				<h1>{modeLabels[mode]} 준비</h1>
				<p>
					{mode === "interview"
						? "내 경험과 기업 자료를 연결해, 지원 직무에 맞게 연습해요."
						: "발표 자료를 알려주세요. 심사위원의 시선으로 질문할게요."}
				</p>
			</header>
			<form className="setup-layout" onSubmit={submit}>
				<section className="form-panel">
					<div className="section-title">
						<h2>
							<span className="step-number">1</span> 연습 자료
						</h2>
						<Button
							type="button"
							variant="ghost"
							disabled={busy || importing}
							onClick={() => {
								setMaterial(examples[mode]);
								setFileName("예시 자료");
								if (mode === "interview")
									setInterviewContext({
										jobPosting:
											"가상 기업 리허설랩의 프론트엔드 개발자 채용. 담당 업무: React 기반 화면 개발과 사용자 경험 개선. 필수 역량: 사용자 피드백을 분석하고 팀과 협업한 경험. 우대 사항: 사용성 테스트 경험.",
										companyInfo:
											"리허설랩은 면접 연습 서비스를 만드는 가상 기업입니다. 실제 기업의 채용공고가 아닌 체험용 예시입니다.",
										companyValues:
											"고객 중심: 사용자 의견을 직접 듣고 개선 결과를 확인합니다. 협업: 서로 다른 의견의 근거를 공유하고 함께 결정합니다.",
									});
								setError("");
							}}
						>
							예시 불러오기
						</Button>
					</div>
					<input
						ref={uploadRef}
						type="file"
						className="visually-hidden"
						id="material-file"
						accept=".pdf,.docx,.pptx,.txt"
						disabled={busy || importing}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) void upload(file);
							event.target.value = "";
						}}
					/>
					<button
						className="upload-zone"
						type="button"
						disabled={busy || importing}
						onClick={() => uploadRef.current?.click()}
						aria-describedby="upload-help"
					>
						<UploadSimple size={28} />
						<strong>
							{busy
								? "파일에서 내용을 읽는 중…"
								: "파일을 선택해 자료 가져오기"}
						</strong>
						<span id="upload-help">PDF, DOCX, PPTX, TXT · 최대 10MB</span>
					</button>
					{fileName && (
						<p className="file-success" role="status">
							<CheckCircle size={18} />
							{fileName} · 아래에서 내용을 확인해 주세요.
						</p>
					)}
					<label className="field-label" htmlFor="material">
						{mode === "interview" ? "이력서 / 자기소개서 / 경험" : "발표 내용"}{" "}
						<span>직접 입력하거나 수정할 수 있어요</span>
					</label>
					<textarea
						id="material"
						rows={11}
						minLength={20}
						maxLength={30000}
						required
						disabled={busy || importing}
						value={material}
						onChange={(event) => setMaterial(event.target.value)}
						placeholder={
							mode === "interview"
								? "지원 동기, 프로젝트 경험, 해결한 문제 등을 적어 주세요."
								: "발표 주제, 해결하려는 문제, 핵심 아이디어와 근거를 적어 주세요."
						}
					/>
					<div className="field-help">
						<span>텍스트가 없는 스캔 파일은 직접 입력해 주세요.</span>
						<span>{material.length.toLocaleString()} / 30,000</span>
					</div>
					{mode === "interview" && (
						<EmployerFields
							value={interviewContext}
							onChange={setInterviewContext}
							onPending={(key, pending) =>
								setImportingFields((previous) => ({
									...previous,
									[key]: pending,
								}))
							}
							disabled={busy || importing}
						/>
					)}
				</section>
				<div className="setup-side">
					<section className="form-panel">
						<h2>
							<span className="step-number">2</span> 연습 설정
						</h2>
						<label className="field-label" htmlFor="practice-role">
							{mode === "interview" ? "지원 직무" : "발표 상황"}
						</label>
						<input
							id="practice-role"
							required
							maxLength={160}
							value={role}
							onChange={(event) => setRole(event.target.value)}
						/>
						<label className="field-label" htmlFor="practice-style">
							연습 방식
						</label>
						<select
							id="practice-style"
							value={practiceStyle}
							onChange={(event) =>
								setPracticeStyle(
									event.target.value === "simulation"
										? "simulation"
										: "coaching",
								)
							}
						>
							<option value="coaching">코칭 · 막히면 단계별 힌트</option>
							<option value="simulation">실전 · 힌트 없이 답변</option>
						</select>
						<label className="field-label" htmlFor="difficulty">
							질문 강도
						</label>
						<select
							id="difficulty"
							value={difficulty}
							onChange={(event) =>
								setDifficulty(
									configSchema.shape.difficulty.parse(event.target.value),
								)
							}
						>
							<option value="gentle">차분하게 · 답변을 이끌어 주는 질문</option>
							<option value="normal">실전처럼 · 구체적인 근거 확인</option>
							<option value="pressure">날카롭게 · 반박과 압박 질문</option>
						</select>
						<label className="field-label" htmlFor="duration">
							목표 연습 시간
						</label>
						<div className="duration-field">
							<input
								id="duration"
								type="number"
								min={1}
								max={30}
								required
								value={Number.isNaN(durationMinutes) ? "" : durationMinutes}
								onChange={(event) => setDuration(event.target.valueAsNumber)}
							/>
							<span>분</span>
						</div>
						<fieldset className="provider-field">
							<legend className="field-label">진행 방식</legend>
							<label>
								<input
									type="radio"
									name="provider"
									value="openai"
									checked={provider === "openai"}
									onChange={() => setProvider("openai")}
								/>
								<span>
									<strong>OpenAI 실전 연습</strong>
									<small>자료와 답변에 맞춘 AI 질문</small>
								</span>
							</label>
							<label>
								<input
									type="radio"
									name="provider"
									value="demo"
									checked={provider === "demo"}
									onChange={() => setProvider("demo")}
								/>
								<span>
									<strong>데모 체험</strong>
									<small>미리 준비된 질문 · 실제 AI 분석 아님</small>
								</span>
							</label>
						</fieldset>
						<p className="connection-note" role="status">
							{statusError ||
								(configured === null
									? "AI 연결 상태 확인 중…"
									: configured
										? "OpenAI 키 설정 확인됨 · 사용량에 따라 API 비용이 발생합니다."
										: "OpenAI 키가 아직 설정되지 않았습니다. 데모는 바로 이용할 수 있어요.")}
						</p>
					</section>
					<div className="privacy-note">
						<ShieldCheck size={20} />
						<p>
							실전 모드에서는 자료와 답변을 OpenAI로 전송합니다. 민감한
							개인정보는 자료에서 지워 주세요.
						</p>
					</div>
					<div role="alert">
						{error && <p className="screen-error">{error}</p>}
					</div>
					<Button
						type="submit"
						busy={busy || importing}
						disabled={
							busy ||
							importing ||
							(provider === "openai" && configured !== true)
						}
					>
						{provider === "demo" ? "데모 연습 시작" : "리허설 시작"}{" "}
						<ArrowRight size={18} />
					</Button>
					<p className="setup-footnote">
						<FileText size={16} /> 완료한 기록은 이 브라우저에 저장됩니다.
					</p>
				</div>
			</form>
		</div>
	);
}
