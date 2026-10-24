import { describe, expect, it } from "vitest";
import { shouldPersistQuery } from "./root-provider";

// 回归：进行中的查询也会被 dehydrate 成 { state, promise }，promise 进不了 JSON
// （序列化成 {}），下次 hydrate 调 promise.then 直接抛错并丢弃整份缓存。
describe("shouldPersistQuery", () => {
	it("持久化已成功的白名单查询", () => {
		expect(
			shouldPersistQuery({
				queryKey: ["totalCount"],
				state: { status: "success" },
			}),
		).toBe(true);
	});

	it("跳过进行中/失败的查询", () => {
		expect(
			shouldPersistQuery({
				queryKey: ["totalCount"],
				state: { status: "pending" },
			}),
		).toBe(false);
		expect(
			shouldPersistQuery({
				queryKey: ["gameList"],
				state: { status: "error" },
			}),
		).toBe(false);
	});

	it("跳过不在白名单里的 key", () => {
		expect(
			shouldPersistQuery({
				queryKey: ["auth"],
				state: { status: "success" },
			}),
		).toBe(false);
	});
});
