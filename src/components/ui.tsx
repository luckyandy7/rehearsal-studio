"use client";
import { CircleNotch } from "@phosphor-icons/react";
import { animate, motion, useReducedMotion } from "motion/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";

// Adapted mechanisms: Animate UI press feedback, React Bits CountUp,
// Magic UI SVG progress, Motion Primitives keyed transitions. See THIRD-PARTY.md.
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	readonly variant?: "primary" | "secondary" | "ghost" | "danger";
	readonly busy?: boolean;
};
export function Button({
	children,
	variant = "primary",
	busy = false,
	className = "",
	disabled,
	...props
}: ButtonProps) {
	return (
		<button
			{...props}
			disabled={disabled || busy}
			aria-busy={busy}
			className={`button button-${variant} ${className}`}
		>
			{busy && <CircleNotch className="spin" size={18} aria-hidden />}
			{children}
		</button>
	);
}
export function CountUp({ value }: { readonly value: number }) {
	const ref = useRef<HTMLSpanElement>(null);
	const reduce = useReducedMotion();
	useEffect(() => {
		if (reduce) return;
		const animation = animate(0, value, {
			duration: 0.45,
			onUpdate: (current) => {
				if (ref.current)
					ref.current.textContent = Math.round(current).toLocaleString("ko-KR");
			},
		});
		return () => animation.stop();
	}, [value, reduce]);
	return <span ref={ref}>{value.toLocaleString("ko-KR")}</span>;
}
export function ProgressRing({
	value,
	label,
}: {
	readonly value: number;
	readonly label: string;
}) {
	const percent = Math.max(0, Math.min(100, value));
	return (
		<div
			className="progress-ring"
			role="img"
			aria-label={`${label} ${Math.round(percent)}%`}
		>
			<svg viewBox="0 0 100 100" fill="none" aria-hidden>
				<circle cx="50" cy="50" r="43" stroke="var(--border)" strokeWidth="6" />
				<circle
					cx="50"
					cy="50"
					r="43"
					stroke="var(--primary)"
					strokeWidth="6"
					strokeLinecap="round"
					strokeDasharray={`${percent * 2.702} 270.2`}
					transform="rotate(-90 50 50)"
				/>
			</svg>
			<span>
				{Math.round(percent)}
				<small>%</small>
			</span>
		</div>
	);
}
export function ViewTransition({
	viewKey,
	children,
}: {
	readonly viewKey: string;
	readonly children: ReactNode;
}) {
	const reduce = useReducedMotion();
	const firstView = useRef(true);
	useEffect(() => {
		firstView.current = false;
	}, []);
	return (
		<motion.div
			key={viewKey}
			initial={
				reduce || (viewKey === "home" && firstView.current)
					? false
					: { opacity: 0, y: 14 }
			}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
		>
			{children}
		</motion.div>
	);
}
export function Waveform({
	active = false,
	level = 0,
}: {
	readonly active?: boolean;
	readonly level?: number;
}) {
	const heights = [
		12, 22, 16, 36, 54, 28, 65, 86, 48, 72, 98, 61, 40, 83, 58, 30, 68, 91, 49,
		34, 70, 55, 24, 43, 19, 31, 15,
	];
	return (
		<div className={`waveform ${active ? "waveform-active" : ""}`} aria-hidden>
			{heights.map((h, i) => (
				<span
					key={`wave-${i}`}
					style={{
						height: `${h}%`,
						animationDelay: `${i * -0.08}s`,
						transform: active
							? `scaleY(${0.35 + Math.min(1, level) * 0.65})`
							: "scaleY(.35)",
					}}
				/>
			))}
		</div>
	);
}
