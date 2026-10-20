"use client";
import {
	ArrowRight,
	ClockCounterClockwise,
	Microphone,
	Plus,
	PresentationChart,
	Trash,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { modeLabels, type PracticeRecord } from "@/lib/types";
import "./screens.css";

type Props = {
	readonly records: readonly PracticeRecord[];
	readonly onOpen: (record: PracticeRecord) => void;
	readonly onDelete: (id: string) => void;
	readonly onStart: () => void;
};
export function History({ records, onOpen, onDelete, onStart }: Props) {
	const [filter, setFilter] = useState("all");
	const [deleting, setDeleting] = useState<string | null>(null);
	const visible = records.filter(
		(record) => filter === "all" || record.config.mode === filter,
	);
	return (
		<div className="screen-stack">
			<header className="history-heading">
				<div className="screen-heading compact">
					<span className="eyebrow">YOUR PRACTICE JOURNAL</span>
					<h1>한 번씩, 더 나아지는 중.</h1>
					<p>지나온 답변을 돌아보고 다음 리허설을 준비하세요.</p>
				</div>
				<Button onClick={onStart}>
					<Plus size={18} /> 새 연습
				</Button>
			</header>
			<section className="form-panel">
				<div className="history-tools">
					<h2>
						연습 기록 <span className="count-badge">{records.length}</span>
					</h2>
					<label className="history-filter">
						종류
						<select
							value={filter}
							onChange={(event) => setFilter(event.target.value)}
						>
							<option value="all">전체</option>
							<option value="interview">면접 연습</option>
							<option value="presentation">발표 연습</option>
						</select>
					</label>
				</div>
				{visible.length === 0 ? (
					<div className="empty-records">
						<ClockCounterClockwise size={40} />
						<h3>
							{records.length === 0
								? "아직 연습 기록이 없어요"
								: "이 모드의 연습 기록이 없어요"}
						</h3>
						<p>리허설을 마치면 대화와 피드백을 다시 볼 수 있어요.</p>
						<Button variant="secondary" onClick={onStart}>
							첫 연습 시작 <ArrowRight />
						</Button>
					</div>
				) : (
					<ul className="history-list">
						{visible.map((record) => (
							<li key={record.id}>
								<div className="history-row">
									<button
										className="record-open"
										type="button"
										onClick={() => onOpen(record)}
									>
										<span className="record-mode-icon">
											{record.config.mode === "interview" ? (
												<Microphone size={22} />
											) : (
												<PresentationChart size={22} />
											)}
										</span>
										<span className="record-title">
											<strong>{record.config.role}</strong>
											<small>
												{modeLabels[record.config.mode]} ·{" "}
												{new Date(record.createdAt).toLocaleString("ko-KR", {
													month: "long",
													day: "numeric",
													hour: "2-digit",
													minute: "2-digit",
												})}{" "}
												· {Math.floor(record.elapsedSeconds / 60)}분{" "}
												{record.elapsedSeconds % 60}초
											</small>
										</span>
										<span className="provider-tag">
											{record.config.provider === "demo" ? "데모" : "OpenAI"}
										</span>
										<ArrowRight size={18} />
									</button>
									<Button
										variant="ghost"
										aria-label={`${record.config.role} 기록 삭제`}
										onClick={() => setDeleting(record.id)}
									>
										<Trash size={20} />
									</Button>
								</div>
								{deleting === record.id && (
									<div className="delete-confirm" role="alert">
										<p>이 기록을 삭제할까요? 삭제하면 복구할 수 없어요.</p>
										<div>
											<Button
												variant="secondary"
												onClick={() => setDeleting(null)}
											>
												취소
											</Button>
											<Button
												variant="danger"
												onClick={() => {
													onDelete(record.id);
													setDeleting(null);
												}}
											>
												삭제하기
											</Button>
										</div>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
			<p className="storage-note">
				기록은 이 브라우저에 최대 30개 저장됩니다. 브라우저 데이터를 지우면
				기록도 삭제됩니다. 보관할 기록은 리포트에서 내려받으세요.
			</p>
		</div>
	);
}
