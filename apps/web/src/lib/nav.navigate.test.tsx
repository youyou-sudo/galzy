// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigate } from "./nav";

/**
 * 回归测试：`navigate({ search: (prev) => ... })` 不能把 query 丢掉。
 *
 * 背景（线上）：`/user` 的安全/喜欢/收藏页签都是
 * `navigate({ to: "/user", search: (prev) => ({ ...prev, tab }) })`。
 * 门面把 `search` 原样交给 furin，而 furin 的 `resolveRouteTarget` 用
 * `Object.keys(search)` 拼 query —— 函数算出来是空对象，目标退化成 `/user`，
 * 地址栏没有 `tab`，切页后又是默认页签 → 表现为「页签点了没反应」。
 * 这里 mock 掉 furin 的 `useNavigate`，直接断言门面交出去的 `search` 已经是对象。
 */

const furin = vi.hoisted(() => ({ navigate: vi.fn(() => Promise.resolve()) }));

vi.mock("@teyik0/furin/link", () => ({
	Link: () => null,
	useNavigate: () => furin.navigate,
	useRouter: () => ({ prefetch: () => undefined }),
}));

function Probe({ destination }: { destination: unknown }) {
	const navigate = useNavigate();
	return (
		<button type="button" onClick={() => void navigate(destination as never)}>
			切换
		</button>
	);
}

function click(destination: unknown): Record<string, unknown> {
	render(<Probe destination={destination} />);
	fireEvent.click(screen.getByRole("button"));
	const call = furin.navigate.mock.calls.at(-1) as [Record<string, unknown>];
	return call[0];
}

describe("useNavigate（search 函数形式）", () => {
	beforeEach(() => {
		window.history.replaceState({}, "", "/user?tab=profile&page=2");
	});

	afterEach(() => {
		cleanup();
		furin.navigate.mockClear();
	});

	it("把 search 函数按当前地址栏求值后再交给 furin", () => {
		const options = click({
			to: "/user",
			search: (prev: Record<string, unknown>) => ({ ...prev, tab: "security" }),
			resetScroll: false,
		});
		expect(options.search).toEqual({ tab: "security", page: "2" });
		expect(options.resetScroll).toBe(false);
	});

	it("对象形式原样透传", () => {
		const options = click({ to: "/user", search: { page: 3 } });
		expect(options.search).toEqual({ page: 3 });
	});

	it("没有 search 时不额外塞字段", () => {
		const options = click({ to: "/user" });
		expect(options.search).toBeUndefined();
	});
});
