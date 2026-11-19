import { describe, expect, it } from "vitest";
import { umamiScript } from "./umami";

const base = {
	NODE_ENV: "production",
	UMAMI_SCRIPT_URL: "https://umami.galzy.moe/script.js",
	UMAMI_DATA_WEBSITE_ID: "94bd852a-409c-4e75-aa8a-9f1d0db439f0",
};

describe("umamiScript", () => {
	it("生产环境且配置齐全时返回脚本配置", () => {
		expect(umamiScript(base)).toEqual({
			scriptUrl: "https://umami.galzy.moe/script.js",
			websiteId: "94bd852a-409c-4e75-aa8a-9f1d0db439f0",
		});
	});

	it("开发环境不注入统计脚本", () => {
		expect(umamiScript({ ...base, NODE_ENV: "development" })).toBeNull();
		expect(umamiScript({ ...base, NODE_ENV: undefined })).toBeNull();
	});

	it("缺少 URL 或站点 id 时不注入（两者缺一不可）", () => {
		expect(umamiScript({ ...base, UMAMI_SCRIPT_URL: undefined })).toBeNull();
		expect(
			umamiScript({ ...base, UMAMI_DATA_WEBSITE_ID: undefined }),
		).toBeNull();
		expect(umamiScript({ ...base, UMAMI_SCRIPT_URL: "   " })).toBeNull();
		expect(umamiScript({ ...base, UMAMI_DATA_WEBSITE_ID: "" })).toBeNull();
	});
});
