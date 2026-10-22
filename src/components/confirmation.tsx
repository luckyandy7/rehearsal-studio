"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";
import { Button } from "./ui";

type Confirmation = {
	title: string;
	description: string;
	label: string;
	danger?: boolean;
	onConfirm: () => void;
};

export function useConfirmation() {
	const [request, setRequest] = useState<Confirmation | null>(null);
	const last = useRef<Confirmation | null>(null);
	const returnFocus = useRef<HTMLElement | null>(null);
	const cancel = useRef<HTMLButtonElement>(null);
	const action = useRef<(() => void) | null>(null);
	const confirm = (next: Confirmation) => {
		returnFocus.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		action.current = null;
		last.current = next;
		setRequest(next);
	};
	const content = request ?? last.current;
	const dialog = (
		<Dialog.Root
			open={!!request}
			onOpenChange={(open) => {
				if (!open) setRequest(null);
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="modal-overlay" />
				<Dialog.Content
					className="modal-content confirmation-modal"
					role="alertdialog"
					onOpenAutoFocus={(event) => {
						event.preventDefault();
						cancel.current?.focus();
					}}
					onPointerDownOutside={(event) => event.preventDefault()}
					onInteractOutside={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						if (returnFocus.current?.isConnected) returnFocus.current.focus();
						else document.getElementById("main")?.focus();
						const next = action.current;
						action.current = null;
						next?.();
						requestAnimationFrame(() => {
							if (
								!returnFocus.current?.isConnected &&
								!document.querySelector('[role="dialog"][data-state="open"]')
							)
								document.getElementById("main")?.focus();
						});
					}}
				>
					<span className="eyebrow">
						{content?.danger ? "기록 관리" : "연습 안내"}
					</span>
					<Dialog.Title>{content?.title}</Dialog.Title>
					<Dialog.Description>{content?.description}</Dialog.Description>
					<div className="confirmation-actions">
						<Dialog.Close asChild>
							<button
								ref={cancel}
								type="button"
								className="button button-secondary"
							>
								취소
							</button>
						</Dialog.Close>
						<Button
							variant={content?.danger ? "danger" : "primary"}
							onClick={() => {
								action.current = content?.onConfirm ?? null;
								setRequest(null);
							}}
						>
							{content?.label}
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
	return { confirm, dialog };
}
