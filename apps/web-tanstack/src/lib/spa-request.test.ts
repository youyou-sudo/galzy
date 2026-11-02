import { requestStorage } from "@web/lib/request-context";
import { describe, expect, it, vi } from "vitest";
import { documentOnly, isSpaDataRequest } from "./spa-request";

/**
 * furin 在路由前会剥掉 `_furin=data`，loader 里拿到的 request 是干净的页面 URL；
 * 原始请求只存在于 server.ts `.wrap()` 写进 AsyncLocalStorage 的那一份。
 * 这两个测试分别覆盖「有请求上下文」和「没有请求上下文」两条路径。
 */
function documentRequest(path = "/admin/users"): Request {
	return new Request(`http://localhost:3000${path}`);
}

function dataRequest(path = "/admin/users"): Request {
	return new Request(`http://localhost:3000${path}?_furin=data`);
}

describe("isSpaDataRequest", () => {
	it("没有请求上下文时按文档请求处理", () => {
		expect(isSpaDataRequest(documentRequest())).toBe(false);
	});

	it("请求上下文里的原始 URL 带 _furin=data 时判定为切页取数", () => {
		const raw = dataRequest();
		// loader 里的 request 已经被剥干净，但只要上下文里的原始请求带标记就算切页
		const stripped = documentRequest();
		const result = requestStorage.run({ request: raw }, () =>
			isSpaDataRequest(stripped),
		);
		expect(result).toBe(true);
	});

	it("文档请求（原始 URL 没有标记）不会被误判", () => {
		const raw = documentRequest();
		const result = requestStorage.run({ request: raw }, () =>
			isSpaDataRequest(raw),
		);
		expect(result).toBe(false);
	});

	it("静态导出的 __furin_data.ndjson 也算切页取数", () => {
		const request = new Request(
			"http://localhost:3000/admin/users/__furin_data.ndjson",
		);
		expect(isSpaDataRequest(request)).toBe(true);
	});

	it("其它查询参数里的 _furin 不会误伤（只看 _furin 这个键）", () => {
		const request = new Request(
			"http://localhost:3000/admin/users?tab=slots&_furinx=1",
		);
		expect(isSpaDataRequest(request)).toBe(false);
	});
});

describe("documentOnly", () => {
	it("文档请求执行取数", async () => {
		const load = vi.fn(async () => ({ total: 1 }));
		const raw = documentRequest();
		const result = await requestStorage.run({ request: raw }, () =>
			documentOnly(raw, load),
		);
		expect(result).toEqual({ total: 1 });
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("切页取数直接返回 null，不触发 web → API → DB 往返", async () => {
		const load = vi.fn(async () => ({ total: 1 }));
		const raw = dataRequest();
		const result = await requestStorage.run({ request: raw }, () =>
			documentOnly(documentRequest(), load),
		);
		expect(result).toBeNull();
		expect(load).not.toHaveBeenCalled();
	});
});
