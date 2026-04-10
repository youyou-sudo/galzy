import { createStore } from "@tanstack/react-store";

type ModalState<T = any> = {
	open: boolean;
	data: T | null;
};

export const downCardStore = createStore<ModalState>({
	open: false,
	data: null,
});

export const downmodalActions = {
	open(data: any) {
		downCardStore.setState((s) => ({
			...s,
			open: true,
			data,
		}));
	},

	setOpen(open: boolean) {
		downCardStore.setState((s) => ({
			...s,
			open: open,
			data: open ? s.data : null,
		}));
	},

	close() {
		downCardStore.setState((s) => ({
			...s,
			open: false,
			data: null,
		}));
	},

	updateData(partial: Partial<{ id: string; name?: string }>) {
		downCardStore.setState((s) => ({
			...s,
			data: s.data ? { ...s.data, ...partial } : null,
		}));
	},
};
