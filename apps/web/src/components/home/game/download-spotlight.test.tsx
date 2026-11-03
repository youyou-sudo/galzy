// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DOWNLOAD_TARGET_ATTR,
	DownloadSpotlight,
	SHOW_MS,
} from "./download-spotlight";

// 导航由用例断言，不拉起真实路由运行时
const navMock = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@web/lib/nav", () => ({
	useNavigate: () => navMock.navigate,
}));

// jsdom 没有 ResizeObserver：给个空实现，组件只用于跟随尺寸变化
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

function spotlight() {
	return document.querySelector<HTMLElement>("[data-download-spotlight]");
}

function opacity() {
	return spotlight()?.style.opacity ?? null;
}

function target() {
	return document.querySelector<HTMLElement>(`[${DOWNLOAD_TARGET_ATTR}]`);
}

function button() {
	return screen.getByRole("button", { name: /下载/ });
}

function tick(ms: number) {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

function renderSpotlight(isDownloadTab = true, gameId = "v1") {
	return render(
		<DownloadSpotlight gameId={gameId} isDownloadTab={isDownloadTab} />,
	);
}

beforeEach(() => {
	vi.useFakeTimers();
	navMock.navigate.mockReset();
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	const el = document.createElement("div");
	el.setAttribute(DOWNLOAD_TARGET_ATTR, "");
	el.textContent = "文件列表";
	document.body.appendChild(el);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	document.body.innerHTML = "";
});

describe("DownloadSpotlight", () => {
	it("默认不可见（常驻 DOM，opacity 0）", () => {
		renderSpotlight();
		expect(spotlight()).not.toBeNull();
		expect(opacity()).toBe("0");
	});

	it("下载页签点击后淡入，2 秒后自动淡出", () => {
		renderSpotlight();
		fireEvent.click(button());
		expect(opacity()).toBe("1");
		tick(SHOW_MS - 1);
		expect(opacity()).toBe("1");
		tick(1);
		expect(opacity()).toBe("0");
	});

	it("连点会刷新这 2 秒", () => {
		renderSpotlight();
		fireEvent.click(button());
		tick(1_500);
		fireEvent.click(button());
		tick(1_500);
		expect(opacity()).toBe("1");
		tick(500);
		expect(opacity()).toBe("0");
	});

	it("其它页签点击：先切回下载页签，切回来后再高亮", () => {
		const { rerender } = renderSpotlight(false, "v9");
		fireEvent.click(button());
		// 只发起导航，不立刻高亮（此时列表还不是下载页签的内容）
		expect(navMock.navigate).toHaveBeenCalledWith({
			to: "/:id",
			params: { id: "v9" },
		});
		expect(opacity()).toBe("0");
		// 模拟导航完成：isDownloadTab 变 true
		rerender(<DownloadSpotlight gameId="v9" isDownloadTab />);
		expect(opacity()).toBe("1");
	});

	it("显示中切到其它页签：立刻收起", () => {
		const { rerender } = renderSpotlight(true, "v9");
		fireEvent.click(button());
		expect(opacity()).toBe("1");
		rerender(<DownloadSpotlight gameId="v9" isDownloadTab={false} />);
		expect(opacity()).toBe("0");
	});

	it("不响应 hover", () => {
		renderSpotlight();
		fireEvent.pointerOver(button());
		expect(opacity()).toBe("0");
		fireEvent.pointerOut(button());
		expect(opacity()).toBe("0");
	});

	it("淡入淡出用 opacity 过渡（不是瞬间切换）", () => {
		renderSpotlight();
		const cls = spotlight()?.className ?? "";
		expect(cls).toContain("transition-opacity");
		expect(cls).toContain("pointer-events-none");
	});

	it("高亮框 aria-hidden，不干扰读屏与点击", () => {
		renderSpotlight();
		expect(spotlight()?.getAttribute("aria-hidden")).toBe("true");
	});

	it("按钮是 default 变体（实心），不是 outline", () => {
		renderSpotlight();
		const cls = button().className;
		expect(cls).toContain("bg-primary");
		expect(cls).not.toContain("bg-background border-border");
	});

	it("Esc 提前淡出", () => {
		renderSpotlight();
		fireEvent.click(button());
		expect(opacity()).toBe("1");
		fireEvent.keyDown(document, { key: "Escape" });
		expect(opacity()).toBe("0");
	});

	it("点列表内部不收起；点空白处收起", () => {
		renderSpotlight();
		fireEvent.click(button());
		const el = target();
		if (el) fireEvent.pointerDown(el);
		expect(opacity()).toBe("1");
		fireEvent.pointerDown(document.body);
		expect(opacity()).toBe("0");
	});

	it("列表不在视口内时，点击会把列表滚进视口", () => {
		const el = target();
		if (!el) throw new Error("缺少 data-download-target 元素");
		const scrollIntoView = vi.fn();
		el.scrollIntoView = scrollIntoView;
		el.getBoundingClientRect = () =>
			({
				top: 2000,
				bottom: 3000,
				left: 0,
				right: 100,
				width: 100,
				height: 1000,
				x: 0,
				y: 2000,
				toJSON: () => ({}),
			}) as DOMRect;
		renderSpotlight();
		fireEvent.click(button());
		expect(scrollIntoView).toHaveBeenCalledTimes(1);
	});
});
