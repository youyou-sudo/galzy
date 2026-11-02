import { skipViewTransitionsForModal } from "@web/lib/view-transition";
import { useEffect, useRef } from "react";

const MODAL_HISTORY_KEY = "__galzy_modal__";

/**
 * 弹窗打开时临时禁用页面上的 view-transition-name。
 *
 * 带 view-transition-name 的元素会被浏览器提到独立合成层：Chrome 在弹窗
 * 打开动画期间做 backdrop-filter 时，这些层可能不参与模糊，出现「封面/标题
 * 短暂清晰、背景已模糊」的漏出。同时如果路由 VT 还没结束，快照伪元素会浮在
 * 遮罩之上。这里用 html 属性 + CSS 把名字临时置 none，关掉弹窗退场动画后再恢复。
 */
let modalVtGuardCount = 0;
let modalVtGuardTimer: ReturnType<typeof setTimeout> | undefined;

function acquireModalVtGuard() {
	modalVtGuardCount++;
	if (modalVtGuardTimer) {
		clearTimeout(modalVtGuardTimer);
		modalVtGuardTimer = undefined;
	}
	if (typeof document !== "undefined") {
		document.documentElement.setAttribute("data-modal-vt-guard", "");
	}
}

function releaseModalVtGuard() {
	modalVtGuardCount = Math.max(0, modalVtGuardCount - 1);
	if (modalVtGuardCount > 0 || typeof document === "undefined") return;
	// 等弹窗退场动画（约 100–200ms）结束再恢复，避免关闭瞬间 VT 名字重新生效
	modalVtGuardTimer = setTimeout(() => {
		if (modalVtGuardCount === 0) {
			document.documentElement.removeAttribute("data-modal-vt-guard");
		}
	}, 240);
}

type HistoryState = Record<string, unknown>;

type UseBrowserBackModalOptions = {
	modalId: string;
	open: boolean;
	onOpen?: () => void;
	onClose: () => void;
};

type UseBrowserBackModalResult = {
	openModal: () => void;
	closeModal: () => void;
	onOpenChange: (open: boolean) => void;
};

function isHistoryState(value: unknown): value is HistoryState {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasModalHistoryState(modalId: string) {
	return (
		typeof window !== "undefined" &&
		isHistoryState(window.history.state) &&
		window.history.state[MODAL_HISTORY_KEY] === modalId
	);
}

function addModalHistoryState(modalId: string) {
	if (typeof window === "undefined" || hasModalHistoryState(modalId)) {
		return;
	}

	const currentState = isHistoryState(window.history.state)
		? window.history.state
		: {};
	window.history.pushState(
		{ ...currentState, [MODAL_HISTORY_KEY]: modalId },
		"",
		window.location.href,
	);
}

function removeModalHistoryState(modalId: string) {
	if (!hasModalHistoryState(modalId)) return;

	const nextState = { ...window.history.state };
	delete nextState[MODAL_HISTORY_KEY];
	window.history.replaceState(nextState, "", window.location.href);
}

export function useBrowserBackModal({
	modalId,
	open,
	onOpen,
	onClose,
}: UseBrowserBackModalOptions): UseBrowserBackModalResult {
	const activeEntryRef = useRef(false);
	const modalIdRef = useRef(modalId);
	const openRef = useRef(open);
	const onCloseRef = useRef(onClose);
	const firstEffectRef = useRef(true);
	const previousOpenRef = useRef(open);
	const vtGuardActiveRef = useRef(false);

	// 打开弹窗的同一个同步调用栈里先移除 VT 名字/跳过快照，再让 Dialog 渲染，
	// 避免遮罩出现的第一帧里封面/标题还没被模糊。
	const acquireGuard = () => {
		if (vtGuardActiveRef.current) return;
		vtGuardActiveRef.current = true;
		acquireModalVtGuard();
		skipViewTransitionsForModal();
	};

	const releaseGuard = () => {
		if (!vtGuardActiveRef.current) return;
		vtGuardActiveRef.current = false;
		releaseModalVtGuard();
	};

	openRef.current = open;
	onCloseRef.current = onClose;

	useEffect(() => {
		const previousModalId = modalIdRef.current;

		if (previousModalId !== modalId) {
			modalIdRef.current = modalId;
			activeEntryRef.current = false;

			if (openRef.current) {
				onCloseRef.current();
			}

			removeModalHistoryState(previousModalId);
		}

		// A route can be restored from a history entry created by a previous
		// component instance. It must not reopen with stale data.
		if (firstEffectRef.current && openRef.current) {
			firstEffectRef.current = false;
			activeEntryRef.current = false;
			onCloseRef.current();
		} else {
			firstEffectRef.current = false;
		}
		removeModalHistoryState(modalId);
	}, [modalId]);

	useEffect(() => {
		if (open && !previousOpenRef.current && !activeEntryRef.current) {
			// 先移除 VT 名字/跳过快照，再 pushState：遮罩第一帧就是干净的
			acquireGuard();
			addModalHistoryState(modalId);
			activeEntryRef.current = true;
		}

		if (!open && previousOpenRef.current && activeEntryRef.current) {
			const shouldGoBack = hasModalHistoryState(modalId);
			activeEntryRef.current = false;
			if (shouldGoBack) {
				window.history.back();
			}
			skipViewTransitionsForModal();
			releaseGuard();
		}

		previousOpenRef.current = open;
	}, [modalId, open]);

	useEffect(() => {
		const handlePopState = () => {
			if (!activeEntryRef.current && !openRef.current) return;

			activeEntryRef.current = false;
			onCloseRef.current();
		};

		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
			activeEntryRef.current = false;
			if (openRef.current) {
				onCloseRef.current();
			}
			releaseGuard();
			removeModalHistoryState(modalIdRef.current);
		};
	}, []);

	const openModal = () => {
		// 同步执行：必须早于 Dialog 把遮罩渲染出来
		acquireGuard();
		if (typeof window !== "undefined" && !activeEntryRef.current) {
			addModalHistoryState(modalId);
			activeEntryRef.current = true;
		}

		onOpen?.();
	};

	const closeModal = () => {
		const shouldGoBack =
			typeof window !== "undefined" &&
			activeEntryRef.current &&
			hasModalHistoryState(modalId);

		activeEntryRef.current = false;
		onClose();

		if (shouldGoBack) {
			window.history.back();
		}
		skipViewTransitionsForModal();
		releaseGuard();
	};

	return {
		openModal,
		closeModal,
		onOpenChange: (nextOpen) => {
			if (nextOpen) {
				openModal();
			} else {
				closeModal();
			}
		},
	};
}
