/**
 * @CLIENT_ONLY — 纯客户端动画逻辑，SSR 不执行。
 *
 * 路由过渡的 compositor-driven 替代实现（替换原生 View Transition）：
 * 只动画 transform/opacity，全程跑在合成器线程，无整页快照 paint、
 * 无全屏纹理混合，导航后新页面立即可交互。
 *
 * 机制（FLIP）：
 * 1. 捕获：导航提交前（onBeforeNavigate，旧 DOM 仍在）批量记录所有
 *    [data-flip-name] 元素的视口 rect 到 flipStore；
 * 2. 播放：新页面中带 useFlipIn(name) 的元素挂载后，从 flipStore 取旧
 *    rect，计算 translate/scale 初始 transform 施加到自身，下一帧过渡回
 *    原位（CSS transition 只含 transform → 合成器驱动）。
 *
 * 文本类元素不缩放（stretch: false，仅位移+淡入），避免飞行中文字
 * 拉伸变形；仅图片类元素（游戏封面）用 stretch: true。
 */

import type { AnyRouter } from "@tanstack/react-router";
import { createStore } from "@tanstack/react-store";
import { useLayoutEffect, useRef } from "react";

const FLIP_DURATION_MS = 350;
const FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type FlipRects = Record<string, DOMRect>;

const flipStore = createStore<FlipRects>({});

function captureFlipRects() {
	const rects: FlipRects = {};
	for (const el of document.querySelectorAll<HTMLElement>("[data-flip-name]")) {
		const name = el.dataset.flipName;
		if (name) rects[name] = el.getBoundingClientRect();
	}
	flipStore.setState(() => rects);
}

/**
 * 安装全局捕获：每次导航提交前记录旧页面所有共享元素的 rect。
 * 返回取消订阅函数（AppChrome 卸载时调用）。
 */
export function installFlipCapture(router: AnyRouter) {
	return router.subscribe("onBeforeNavigate", captureFlipRects);
}

function prefersReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 播放共享元素「飞入」动画。
 * 在元素挂载后（useLayoutEffect，绘制前）读取旧页面 rect，用 transform
 * 把元素置于旧位置/旧尺寸，再过渡回自然位置。无旧 rect（直达/刷新/
 * reduced-motion）则静默跳过。
 */
export function useFlipIn<T extends HTMLElement = HTMLElement>(
	name: string | undefined,
	stretch = false,
) {
	const ref = useRef<T>(null);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || !name) return;
		if (prefersReducedMotion()) return;

		const from = flipStore.state[name];
		if (!from) return;

		flipStore.setState((s) => {
			const { [name]: _consumed, ...rest } = s;
			return rest;
		});

		const to = el.getBoundingClientRect();
		const dx = from.left - to.left;
		const dy = from.top - to.top;

		el.style.transformOrigin = "0 0";
		el.style.transform = stretch
			? `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`
			: `translate(${dx}px, ${dy}px)`;
		// 文本类元素飞行中淡入；封面等图片元素全程不透明（与原位替换观感一致）
		if (!stretch) el.style.opacity = "0";

		// 强制 reflow，让初始 transform/opacity 先落地，再过渡回原位
		void el.getBoundingClientRect();
		el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASING}, opacity ${FLIP_DURATION_MS}ms ease-out`;
		el.style.willChange = "transform";
		el.style.transform = "none";
		if (!stretch) el.style.opacity = "1";

		const cleanup = () => {
			el.style.transition = "";
			el.style.transform = "";
			el.style.transformOrigin = "";
			el.style.opacity = "";
			el.style.willChange = "";
		};
		el.addEventListener("transitionend", cleanup, { once: true });
		// reduced-motion / transition 被禁用时 transitionend 不触发，兜底清理
		window.setTimeout(cleanup, FLIP_DURATION_MS + 50);
	}, [name, stretch]);

	return ref;
}
