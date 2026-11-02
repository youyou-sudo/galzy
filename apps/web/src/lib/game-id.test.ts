import { describe, expect, it } from "vitest";
import {
	canonicalGameId,
	canonicalRedirectTarget,
	isGameRouteId,
	isSameGameRouteId,
	normalizeGameRouteId,
	readGameIdentity,
} from "./game-id";

describe("isGameRouteId", () => {
	it("接受 vNNN / dNNN（大小写不敏感）与 kgX", () => {
		for (const id of ["v19658", "V19658", "d123", "kg22085", "kgAbC"]) {
			expect(isGameRouteId(id)).toBe(true);
		}
	});

	it("拒绝其它形态", () => {
		for (const id of ["", "123", "abc", "v12a", "kg", "kg "]) {
			expect(isGameRouteId(id)).toBe(false);
		}
	});
});

describe("normalizeGameRouteId", () => {
	it("v/d 前缀统一小写", () => {
		expect(normalizeGameRouteId("V19658")).toBe("v19658");
		expect(normalizeGameRouteId("D9")).toBe("d9");
	});

	it("kg 只归一前缀，kungal work id 原样保留", () => {
		expect(normalizeGameRouteId("kgAbC")).toBe("kgAbC");
		expect(normalizeGameRouteId("KGAbC")).toBe("kgAbC");
		expect(normalizeGameRouteId("kg22085")).toBe("kg22085");
	});
});

describe("isSameGameRouteId", () => {
	it("v 侧忽略大小写", () => {
		expect(isSameGameRouteId("v19658", "V19658")).toBe(true);
	});

	it("kungal work id 大小写敏感（仅前缀不敏感）", () => {
		expect(isSameGameRouteId("kgAbC", "kgabc")).toBe(false);
		expect(isSameGameRouteId("kgAbC", "KGAbC")).toBe(true);
	});

	it("跨命名空间不相等", () => {
		expect(isSameGameRouteId("v123", "kg123")).toBe(false);
	});
});

describe("readGameIdentity", () => {
	it("缺字段时全部 undefined（API 未上线阶段的兼容路径）", () => {
		expect(readGameIdentity({ vn: {} })).toEqual({
			canonicalId: undefined,
			displayId: undefined,
			anchorKind: undefined,
			kungalOnly: undefined,
		});
	});

	it("读取契约 §5 字段并丢弃非法 id / anchorKind", () => {
		expect(
			readGameIdentity({
				canonicalId: "V19658",
				displayId: "kgAbC",
				anchorKind: "kungal",
				kungalOnly: true,
			}),
		).toEqual({
			canonicalId: "v19658",
			displayId: "kgAbC",
			anchorKind: "kungal",
			kungalOnly: true,
		});

		expect(
			readGameIdentity({
				canonicalId: "42",
				anchorKind: "weird",
				kungalOnly: "yes",
			}),
		).toEqual({
			canonicalId: undefined,
			displayId: undefined,
			anchorKind: undefined,
			kungalOnly: undefined,
		});
	});
});

describe("canonicalGameId / canonicalRedirectTarget", () => {
	const game = { canonicalId: "v19658" };

	it("canonicalId 优先，缺失时回退请求 id", () => {
		expect(canonicalGameId(game, "kg22085")).toBe("v19658");
		expect(canonicalGameId({}, "KGAbC")).toBe("kgAbC");
		expect(canonicalGameId(null, "V123")).toBe("v123");
	});

	it("仅当身份不同才返回跳转目标", () => {
		expect(canonicalRedirectTarget(game, "kg22085")).toBe("v19658");
		expect(canonicalRedirectTarget(game, "V19658")).toBeNull();
		expect(
			canonicalRedirectTarget({ canonicalId: "kgAbC" }, "KGAbC"),
		).toBeNull();
		expect(canonicalRedirectTarget({ canonicalId: "kgAbC" }, "kgabc")).toBe(
			"kgAbC",
		);
	});
});
