import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
	formatDuration,
	formatRelativeTime,
	patchListItems,
	prependListItem,
	removeListItems,
	restoreSnapshot,
	snapshotQueries,
} from "./optimistic";

type Item = { id: string; status: string };

function createClient() {
	return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const listKey = ["admin", "comments", "list"] as const;

describe("optimistic 缓存原语", () => {
	it("patchListItems 命中前缀下的所有分页缓存", () => {
		const qc = createClient();
		const page1 = { comments: [{ id: "1", status: "normal" }], total: 2 };
		const page2 = {
			comments: [
				{ id: "2", status: "normal" },
				{ id: "3", status: "normal" },
			],
			total: 2,
		};
		qc.setQueryData([...listKey, { offset: 0 }], page1);
		qc.setQueryData([...listKey, { offset: 20 }], page2);

		patchListItems<Item>(qc, listKey, "comments", (item) =>
			item.id === "1" ? { ...item, status: "hidden" } : item,
		);

		expect(
			(qc.getQueryData([...listKey, { offset: 0 }]) as typeof page1).comments[0]
				.status,
		).toBe("hidden");
		// 未命中的分页保持引用不变（避免无意义重渲染）
		expect(qc.getQueryData([...listKey, { offset: 20 }])).toBe(page2);
	});

	it("removeListItems 删除并同步 total", () => {
		const qc = createClient();
		qc.setQueryData([...listKey, {}], {
			comments: [
				{ id: "1", status: "normal" },
				{ id: "2", status: "normal" },
			],
			total: 10,
		});

		removeListItems<Item>(qc, listKey, "comments", (item) => item.id === "1");

		const next = qc.getQueryData([...listKey, {}]) as {
			comments: Item[];
			total: number;
		};
		expect(next.comments.map((item) => item.id)).toEqual(["2"]);
		expect(next.total).toBe(9);
	});

	it("prependListItem 插入到头部并把 total +1", () => {
		const qc = createClient();
		qc.setQueryData([...listKey, {}], { items: [{ id: "1" }], total: 1 });
		prependListItem(qc, listKey, "items", { id: "new" });
		const next = qc.getQueryData([...listKey, {}]) as {
			items: { id: string }[];
			total: number;
		};
		expect(next.items.map((item) => item.id)).toEqual(["new", "1"]);
		expect(next.total).toBe(2);
	});

	it("快照可回滚到操作前状态", () => {
		const qc = createClient();
		const before = { items: [{ id: "1" }], total: 1 };
		qc.setQueryData([...listKey, {}], before);
		const snapshot = snapshotQueries(qc, [listKey]);

		removeListItems(qc, listKey, "items", () => true);
		expect((qc.getQueryData([...listKey, {}]) as typeof before).total).toBe(0);

		restoreSnapshot(qc, snapshot);
		// TanStack 的 structuralSharing 可能返回深拷贝，这里只断言数据回到操作前
		expect(qc.getQueryData([...listKey, {}])).toEqual(before);
	});
});

describe("时间格式化", () => {
	it("formatRelativeTime 覆盖秒/分/小时", () => {
		const now = Date.now();
		expect(formatRelativeTime(new Date(now - 5_000))).toBe("刚刚");
		expect(formatRelativeTime(new Date(now - 90_000))).toBe("1 分钟前");
		expect(formatRelativeTime(new Date(now - 3 * 3600_000))).toBe("3 小时前");
		expect(formatRelativeTime(null)).toBe("-");
	});

	it("formatDuration 有结束时间时按差值，否则算到现在", () => {
		const startedAt = new Date(Date.now() - 65_000).toISOString();
		expect(formatDuration(startedAt, new Date().toISOString())).toMatch(/1m/);
		expect(formatDuration(null, null)).toBe("-");
	});
});
