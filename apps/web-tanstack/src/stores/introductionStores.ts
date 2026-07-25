/**
 * @CLIENT_ONLY — 纯客户端 UI 状态，SSR 只读默认值。
 */
import { createStore } from "@tanstack/react-store";

type ModalState<T = any> = {
	open: boolean;
	data: T | null;
};

export const introductionEditStore = createStore<ModalState>({
	open: false,
	data: null,
});

export const introductionEditActions = {
	setOpen(data: any) {
		introductionEditStore.setState((s) => ({
			...s,
			open: true,
			data: data,
		}));
	},

	close() {
		introductionEditStore.setState((s) => ({
			...s,
			open: false,
			data: null,
		}));
	},

	onOpen() {
		introductionEditStore.setState((s) => ({
			...s,
			open: !s.open,
			data: s.open ? s.data : null,
		}));
	},
};
