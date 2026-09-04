import { useEffect, useRef } from "react";

const MODAL_HISTORY_KEY = "__galzy_modal__";

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
			addModalHistoryState(modalId);
			activeEntryRef.current = true;
		}

		if (!open && previousOpenRef.current && activeEntryRef.current) {
			const shouldGoBack = hasModalHistoryState(modalId);
			activeEntryRef.current = false;
			if (shouldGoBack) {
				window.history.back();
			}
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
			removeModalHistoryState(modalIdRef.current);
		};
	}, []);

	const openModal = () => {
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
