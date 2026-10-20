"use client";
import {
	ClockCounterClockwise,
	House,
	Microphone,
	PresentationChart,
	Question,
	Waveform,
	X,
} from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { readRecords, writeRecords } from "@/lib/storage";
import type { Mode, PracticeRecord, SessionConfig } from "@/lib/types";
import { History } from "./history";
import { Home } from "./home";
import { ReportView } from "./report";
import { Session } from "./session";
import { SessionGuide } from "./session-guide";
import { Setup } from "./setup";
import { Button } from "./ui";

type View =
	| { kind: "home" | "history" }
	| { kind: "setup"; mode: Mode }
	| { kind: "session"; config: SessionConfig; id: string }
	| { kind: "report"; record: PracticeRecord };
export function StudioApp() {
	const [view, setView] = useState<View>({ kind: "home" });
	const [records, setRecords] = useState<PracticeRecord[]>([]);
	const [notice, setNotice] = useState("");
	const [pendingSession, setPendingSession] = useState<SessionConfig | null>(
		null,
	);
	const entryFocus = useRef<HTMLElement | null>(null);
	const prepareSession = (config: SessionConfig) => {
		entryFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		setPendingSession(config);
	};
	useEffect(() => {
		try {
			setRecords(readRecords());
		} catch {
			setNotice(
				"브라우저 저장소를 사용할 수 없습니다. 리포트를 파일로 내려받아 주세요.",
			);
		}
	}, []);
	useEffect(() => {
		if (view.kind !== "session") return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [view.kind]);
	const navigate = (next: View) => {
		if (
			view.kind === "session" &&
			!window.confirm(
				"연습을 나가면 아직 저장하지 않은 대화가 사라집니다. 나갈까요?",
			)
		)
			return;
		setView(next);
	};
	const start = (mode: Mode) => navigate({ kind: "setup", mode });
	const save = (next: PracticeRecord[]) => {
		setRecords(next);
		try {
			writeRecords(next);
		} catch {
			setNotice(
				"저장 공간이 부족하거나 차단되었습니다. 리포트를 파일로 내려받아 주세요.",
			);
		}
	};
	return (
		<div className="app-shell">
			{pendingSession && (
				<SessionGuide
					config={pendingSession}
					returnFocus={entryFocus.current}
					onCancel={() => setPendingSession(null)}
					onEnter={() => {
						setView({
							kind: "session",
							config: pendingSession,
							id: crypto.randomUUID(),
						});
						setPendingSession(null);
					}}
				/>
			)}
			<a className="skip-link" href="#main">
				본문으로 이동
			</a>
			<aside className="sidebar">
				<button
					type="button"
					className="brand"
					onClick={() => navigate({ kind: "home" })}
				>
					<span className="brand-mark">
						<Waveform size={23} weight="bold" />
					</span>
					rehearsal
				</button>
				<span className="sidebar-label">나만의 연습실</span>
				<nav aria-label="주 메뉴">
					{[
						{ label: "연습실 홈", kind: "home", Icon: House },
						{ label: "면접 연습", kind: "interview", Icon: Microphone },
						{
							label: "발표 연습",
							kind: "presentation",
							Icon: PresentationChart,
						},
						{
							label: "연습 기록",
							kind: "history",
							Icon: ClockCounterClockwise,
						},
					].map(({ label, kind, Icon }) => (
						<button
							key={kind}
							type="button"
							className={`nav-button ${view.kind === kind || (view.kind === "setup" && view.mode === kind) || (view.kind === "session" && view.config.mode === kind) ? "active" : ""}`}
							onClick={() =>
								kind === "interview" || kind === "presentation"
									? start(kind)
									: navigate({ kind: kind === "home" ? "home" : "history" })
							}
						>
							<Icon size={21} />
							{label}
						</button>
					))}
				</nav>
				<div className="sidebar-bottom">
					<div className="privacy-card">
						어제보다 편안하게.
						<br />
						<small>나의 속도로 연습하는 공간</small>
					</div>
				</div>
			</aside>
			<div className="main-shell">
				<header className="topbar">
					<span className="breadcrumb">
						나의 리허설 /{" "}
						{view.kind === "history"
							? "연습 기록"
							: view.kind === "report"
								? "피드백"
								: "연습실"}
					</span>
					<div className="topbar-right">
						<span className="local-badge">기록은 이 브라우저에 저장</span>
						<Dialog.Root>
							<Dialog.Trigger asChild>
								<Button variant="ghost" aria-label="도움말">
									<Question size={22} />
								</Button>
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay className="modal-overlay" />
								<Dialog.Content className="modal-content">
									<Dialog.Title>리허설 사용 안내</Dialog.Title>
									<Dialog.Description>
										자료를 넣고, 직접 답하고, 근거와 함께 돌아보세요.
									</Dialog.Description>
									<p>
										면접은 자기소개서의 경험을 질문합니다. 발표는 설명의 근거와
										한계를 질문합니다. PDF·DOCX·PPTX·TXT 자료를 올릴 수 있으며
										이미지 속 글자는 추출하지 않습니다.
									</p>
									<p>
										OpenAI 모드는 자료와 답변을 OpenAI에 보내며 사용 요금이
										발생합니다. 데모 모드는 준비된 질문만 사용합니다. 음성은
										AI가 생성합니다.
									</p>
									<p>
										완료한 대화와 자료는 이 브라우저에 최대 30개 저장됩니다.
										민감한 개인정보는 자료에서 지워 주세요. 기록 화면에서 삭제할
										수 있습니다.
									</p>
									<Dialog.Close asChild>
										<Button variant="secondary">
											<X /> 닫기
										</Button>
									</Dialog.Close>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</div>
				</header>
				<main id="main" className="content">
					{notice && (
						<p className="error-box" role="status">
							{notice}
						</p>
					)}
					{view.kind === "home" && (
						<Home
							records={records}
							onStart={start}
							onHistory={() => navigate({ kind: "history" })}
							onOpen={(record) => setView({ kind: "report", record })}
						/>
					)}
					{view.kind === "setup" && (
						<Setup
							key={view.mode}
							mode={view.mode}
							onBack={() => setView({ kind: "home" })}
							onStart={prepareSession}
						/>
					)}
					{view.kind === "session" && (
						<Session
							key={view.id}
							config={view.config}
							onComplete={(record) => {
								save([record, ...records].slice(0, 30));
								setView({ kind: "report", record });
							}}
						/>
					)}
					{view.kind === "history" && (
						<History
							records={records}
							onOpen={(record) => setView({ kind: "report", record })}
							onDelete={(id) =>
								save(records.filter((record) => record.id !== id))
							}
							onStart={() => setView({ kind: "home" })}
						/>
					)}
					{view.kind === "report" && (
						<ReportView
							record={view.record}
							onBack={() => setView({ kind: "history" })}
							onRetry={prepareSession}
						/>
					)}
				</main>
				<footer className="app-footer">
					리허설 · 정답보다, 더 나은 다음 답변을 위해.
				</footer>
			</div>
		</div>
	);
}
