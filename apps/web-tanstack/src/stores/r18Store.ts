/**
 * @CLIENT_ONLY — 引用 localStorage，仅浏览器可用。
 * SSR 期间不调用 toggle（Header 的按钮需要用户点击），
 * getDefaultR18ShowEnabled 在无 localStorage 时默认 false（只显示健康内容）。
 */
import { createStore } from "@tanstack/react-store";

function getDefaultR18ShowEnabled(): boolean {
	try {
		if (typeof localStorage !== "undefined") {
			const stored = localStorage.getItem("r18-show");
			if (stored !== null) return stored === "true";
			// 旧版 r18-blur 迁移：blur 关闭 = 想看全部 → 显示 R18；blur 开启/缺省 → 过滤
			const legacy = localStorage.getItem("r18-blur");
			if (legacy !== null) return legacy === "false";
		}
	} catch {
		// localStorage unavailable
	}
	return false;
}

export const r18Store = createStore({
	showR18: getDefaultR18ShowEnabled(),
});

export const r18Actions = {
	toggle() {
		r18Store.setState((s) => {
			const next = !s.showR18;
			try {
				localStorage.setItem("r18-show", String(next));
			} catch {
				// localStorage unavailable
			}
			return { ...s, showR18: next };
		});
	},
};
