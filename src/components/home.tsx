"use client";
import {
	ArrowRight,
	ArrowUpRight,
	Chats,
	Clock,
	Microphone,
	PresentationChart,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button, CountUp } from "@/components/ui";
import { type Mode, modeLabels, type PracticeRecord } from "@/lib/types";
import "./screens.css";

type Props = {
	readonly records: readonly PracticeRecord[];
	readonly onStart: (mode: Mode) => void;
	readonly onHistory: () => void;
	readonly onOpen: (record: PracticeRecord) => void;
};
export function Home({ records, onStart, onHistory, onOpen }: Props) {
	const [motionPaused, setMotionPaused] = useState(false);
	const entrance = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const animations: Animation[] = [];
		const preference = matchMedia("(prefers-reduced-motion: reduce)");
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					if (!preference.matches)
						animations.push(
							entry.target.animate(
								[
									{ opacity: 0, transform: "translateY(48px)" },
									{ opacity: 1, transform: "translateY(0)" },
								],
								{
									duration: 850,
									easing: "cubic-bezier(.16,1,.3,1)",
									fill: "backwards",
								},
							),
						);
					observer.unobserve(entry.target);
				}
			},
			{ threshold: 0.12 },
		);
		entrance.current
			?.querySelectorAll(".screen-heading, .mode-card, .home-bottom > *")
			.forEach((element) => {
				observer.observe(element);
			});
		const stop = () => {
			if (preference.matches)
				for (const animation of animations) animation.cancel();
		};
		preference.addEventListener("change", stop);
		return () => {
			observer.disconnect();
			preference.removeEventListener("change", stop);
			for (const animation of animations) animation.cancel();
		};
	}, []);
	return (
		<div className="screen-stack home-entrance" ref={entrance}>
			<div className="studio-masthead">
				<span>Practice makes possibility.</span>
				<div className="studio-ticker-window" aria-hidden="true">
					<div className="studio-ticker" data-paused={motionPaused}>
						<span>
							<Image
								src="/brand/rehearsal-icon.png"
								alt=""
								width={220}
								height={220}
								unoptimized
							/>
							rehearsal —&nbsp;
						</span>
						<span>
							<Image
								src="/brand/rehearsal-icon.png"
								alt=""
								width={220}
								height={220}
								unoptimized
							/>
							rehearsal —&nbsp;
						</span>
					</div>
				</div>
				<button
					className="studio-motion-toggle"
					type="button"
					aria-pressed={motionPaused}
					onClick={() => setMotionPaused(!motionPaused)}
				>
					{motionPaused ? "타이포 모션 재생" : "타이포 모션 일시정지"}
				</button>
				<p>당신의 다음 순간을 위한 연습실.</p>
			</div>
			<header className="screen-heading">
				<span className="eyebrow">YOUR PRACTICE STUDIO</span>
				<h1>
					중요한 순간 전,
					<br />한 번 더 리허설.
				</h1>
				<p>
					생각을 말로 꺼내고, 질문을 마주하고.
					<br className="mobile-break" /> 나의 답변에서 다음 가능성을
					찾아보세요.
				</p>
			</header>
			<section className="mode-grid" aria-label="연습 모드 선택">
				<article className="mode-card interview-card">
					<div className="mode-top">
						<span className="mode-icon">
							<Microphone size={26} />
						</span>
						<span className="small-label">01 / INTERVIEW</span>
					</div>
					<h2>나를 더 잘 말하는 연습</h2>
					<p>
						자기소개서에서 시작하는 질문과 꼬리 질문.
						<br />내 경험을 설득력 있는 답변으로 만들어 보세요.
					</p>
					<div className="question-preview">
						<span>질문 예시</span>
						<p>
							“그 경험에서 본인이 직접
							<br />
							바꾼 것은 무엇인가요?”
						</p>
					</div>
					<Button onClick={() => onStart("interview")}>
						면접 연습 시작 <ArrowRight size={18} />
					</Button>
				</article>
				<article className="mode-card presentation-card">
					<div className="mode-top">
						<span className="mode-icon">
							<PresentationChart size={26} />
						</span>
						<span className="small-label">02 / PRESENTATION</span>
					</div>
					<h2>아이디어를 설득하는 연습</h2>
					<p>
						발표 자료를 이해한 AI 심사위원과 실전처럼.
						<br />
						예상 밖의 질문에도 내 논리를 이어가세요.
					</p>
					<div className="question-preview">
						<span>질문 예시</span>
						<p>
							“잠깐, 기존 서비스와 다른 점을
							<br />한 문장으로 설명해 주세요.”
						</p>
					</div>
					<Button variant="secondary" onClick={() => onStart("presentation")}>
						발표 연습 시작 <ArrowRight size={18} />
					</Button>
				</article>
			</section>
			<section className="home-bottom">
				<div className="recent-practice">
					<div className="section-title">
						<h2>최근 리허설</h2>
						<Button variant="ghost" onClick={onHistory}>
							전체 기록 <ArrowUpRight size={16} />
						</Button>
					</div>
					{records.length === 0 ? (
						<div className="empty-inline">
							<Chats size={28} />
							<div>
								<strong>첫 리허설을 기다리고 있어요</strong>
								<p>연습을 마치면 답변과 피드백이 여기에 쌓입니다.</p>
							</div>
						</div>
					) : (
						<div className="record-list">
							{records.slice(0, 3).map((record) => (
								<button
									type="button"
									className="record-open"
									key={record.id}
									onClick={() => onOpen(record)}
								>
									<span className="record-mode-icon">
										{record.config.mode === "interview" ? (
											<Microphone size={20} />
										) : (
											<PresentationChart size={20} />
										)}
									</span>
									<span className="record-title">
										<strong>{record.config.role}</strong>
										<small>
											{modeLabels[record.config.mode]} ·{" "}
											{new Date(record.createdAt).toLocaleDateString("ko-KR")}
										</small>
									</span>
									<ArrowRight size={18} />
								</button>
							))}
						</div>
					)}
				</div>
				<aside className="practice-note">
					<span className="eyebrow">SMALL STEPS, REAL PROGRESS</span>
					{records.length > 0 ? (
						<>
							<div className="real-stat">
								<CountUp value={records.length} />
								<span>번의 리허설</span>
							</div>
							<p>
								작은 연습이 쌓여 더 자연스러운
								<br />
								다음 답변이 됩니다.
							</p>
						</>
					) : (
						<>
							<Clock size={24} />
							<h3>짧게 시작해도 괜찮아요.</h3>
							<p>
								5분의 연습으로 내 말의 습관을 발견해 보세요. 자료가 없다면
								예시로 먼저 체험할 수 있어요.
							</p>
						</>
					)}
				</aside>
			</section>
		</div>
	);
}
