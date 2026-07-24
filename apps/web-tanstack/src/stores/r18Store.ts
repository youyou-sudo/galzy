import { createStore } from "@tanstack/react-store";

function getDefaultR18BlurEnabled(): boolean {
	try {
		const stored =
			typeof localStorage !== "undefined"
				? localStorage.getItem("r18-blur")
				: null;
		return stored !== null ? stored === "true" : true;
	} catch {
		return true;
	}
}

export const r18Store = createStore({
	blurEnabled: getDefaultR18BlurEnabled(),
});

export const r18Actions = {
	toggle() {
		r18Store.setState((s) => {
			const next = !s.blurEnabled;
			try {
				localStorage.setItem("r18-blur", String(next));
			} catch {
				// localStorage unavailable
			}
			return { ...s, blurEnabled: next };
		});
	},
};
