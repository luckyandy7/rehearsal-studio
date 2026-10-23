"use client";
import { useEffect } from "react";

export function useLayoutMotion() {
	useEffect(() => {
		const root = document.getElementById("main");
		if (!root) return;
		const reduced = matchMedia("(prefers-reduced-motion: reduce)");
		const selector =
			":scope > *, .screen-stack > *, .practice-aside > *, .record-list > *";
		let positions = new Map<Element, number>();
		const animations = new Map<Element, Animation>();
		const measure = () => {
			const next = new Map<Element, number>();
			for (const element of root.querySelectorAll(selector)) {
				next.set(element, element.getBoundingClientRect().top + window.scrollY);
			}
			return next;
		};
		positions = measure();
		const observer = new MutationObserver((records) => {
			if (
				!records.some((record) =>
					[...record.addedNodes, ...record.removedNodes].some(
						(node) => node.nodeType === Node.ELEMENT_NODE,
					),
				)
			)
				return;
			for (const animation of animations.values()) animation.cancel();
			animations.clear();
			const next = measure();
			if (!reduced.matches) {
				const moving: Element[] = [];
				for (const [element, top] of next) {
					const previous = positions.get(element);
					if (
						previous === undefined ||
						Math.abs(previous - top) < 2 ||
						moving.some((parent) => parent.contains(element))
					)
						continue;
					moving.push(element);
					const animation = element.animate(
						[{ translate: `0 ${previous - top}px` }, { translate: "0 0" }],
						{ duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
					);
					animations.set(element, animation);
				}
			}
			positions = next;
		});
		observer.observe(root, { childList: true, subtree: true });
		const resize = new ResizeObserver(() => {
			if (
				![...animations.values()].some(
					(animation) => animation.playState === "running",
				)
			)
				positions = measure();
		});
		resize.observe(root);
		return () => {
			observer.disconnect();
			resize.disconnect();
			for (const animation of animations.values()) animation.cancel();
		};
	}, []);
}
