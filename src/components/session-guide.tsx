"use client";
import * as Dialog from "@radix-ui/react-dialog";
import type { CameraController } from "@/hooks/use-camera-analysis";
import type { SessionConfig } from "@/lib/types";
import { CameraPreparation } from "./camera-panel";
import { Button } from "./ui";

export function SessionGuide({
	config,
	camera,
	onCancel,
	onEnter,
	returnFocus,
}: {
	readonly config: SessionConfig;
	readonly camera: CameraController;
	readonly onCancel: () => void;
	readonly onEnter: () => void;
	readonly returnFocus: HTMLElement | null;
}) {
	const interview = config.mode === "interview";
	const demo = config.provider === "demo";
	return (
		<Dialog.Root
			open
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="modal-overlay" />
				<Dialog.Content
					className="modal-content session-guide"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						if (returnFocus?.isConnected) returnFocus.focus();
					}}
				>
					<span className="eyebrow">
						입장 전 안내 · {demo ? "데모 체험" : "실전 연습"}
					</span>
					<Dialog.Title>
						{interview
							? "면접부터 리포트까지, 이렇게 진행해요"
							: "발표부터 리포트까지, 이렇게 진행해요"}
					</Dialog.Title>
					<Dialog.Description>
						연습을 마친 뒤 리포트를 직접 생성해 주세요. 아래 순서대로 누르면
						돼요.
					</Dialog.Description>
					<div className="session-guide-scroll">
						<CameraPreparation camera={camera} />
						<section
							className="session-guide-flow"
							aria-labelledby="session-guide-flow-title"
						>
							<h3 id="session-guide-flow-title">입장 후 진행 순서</h3>
							<p>설정은 여기까지예요. 아래 순서만 확인하고 입장해 주세요.</p>
							<ol className="session-guide-steps">
								<li>
									<strong>
										{config.retry
											? "선택한 질문에 다시 답하기"
											: demo
												? "첫 질문 받기"
												: "실시간 음성 연결"}
									</strong>
									<p>
										{config.retry
											? "선택한 질문이 입장과 함께 표시돼요. 답변 후 결과를 확인하세요. 임시 기록에서 돌아왔다면 계속하기를 눌러 주세요."
											: demo
												? "입장 후 첫 질문 받기를 눌러 텍스트 체험을 시작해요."
												: "입장 후 실시간 음성 연결을 누르고 마이크를 허용해 주세요. 글로 연습하려면 첫 질문 받기를 선택해요."}
									</p>
								</li>
								<li>
									<strong>
										{interview
											? "질문을 듣고 답변하기"
											: "발표하고 질문에 답하기"}
									</strong>
									<p>
										{demo
											? "답변을 입력하고 제출해 주세요. 데모는 실제 AI 평가를 하지 않아요."
											: "말한 내용이 나의 답변 자막으로 나타나는지 확인해 주세요. 잠시 쉬려면 일시 정지를 누르면 돼요."}
									</p>
								</li>
								<li>
									<strong>연습 종료 · 리포트 생성</strong>
									<p>
										상단에 고정된 파란 버튼을 눌러요. 답변이 한 번 이상 기록되면
										생성할 수 있고, 음성 연습도 함께 종료돼요.
									</p>
								</li>
								<li>
									<strong>리포트 확인하고 저장하기</strong>
									<p>
										완성된 리포트가 바로 열려요. 리포트 저장으로 파일을
										내려받거나 연습 기록에서 다시 확인하세요. 질문별 복습 ·
										재도전에서 답변을 골라 다시 연습할 수 있어요.
									</p>
								</li>
							</ol>
						</section>
					</div>
					<div className="session-guide-actions">
						<Button variant="secondary" onClick={onCancel}>
							돌아가기
						</Button>
						<Button
							onClick={onEnter}
							disabled={
								camera.status === "loading" ||
								(!!camera.stream && !camera.calibrated)
							}
						>
							{interview
								? "확인했어요 · 면접방 입장"
								: "확인했어요 · 발표방 입장"}
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
