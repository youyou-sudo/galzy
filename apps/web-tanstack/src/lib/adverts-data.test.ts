import type { AdSlotPayload } from "@web/lib/adverts";
import { requestStorage } from "@web/lib/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdSlotMock = vi.hoisted(() =>
	vi.fn(
		async (_args: { data: { key: string } }): Promise<AdSlotPayload | null> =>
			null,
	),
);

vi.mock("@web/server/adverts", () => ({
	getAdSlot: getAdSlotMock,
}));

const { loadTopAdSlot } = await import("@web/lib/adverts-data");

function requestFor(pathname: string): Request {
	return new Request(`http://localhost${pathname}`);
}

const payload: AdSlotPayload = {
	slot: {
		key: "home_top",
		name: "首页顶部横幅",
		maxItems: 1,
		mobileMode: "carousel",
		carouselInterval: 0,
	},
	desktop: [
		{
			id: 1,
			name: "dzmm",
			image: "/dzmm.webp",
			href: "https://x.test",
			device: "all",
		},
	],
	mobile: [],
};

beforeEach(() => {
	getAdSlotMock.mockReset();
});

describe("loadTopAdSlot", () => {
	it("首页返回在投素材，供 SSR 首帧直接渲染广告", async () => {
		getAdSlotMock.mockResolvedValueOnce(payload);

		await expect(loadTopAdSlot(requestFor("/"))).resolves.toEqual(payload);
		expect(getAdSlotMock).toHaveBeenCalledWith({ data: { key: "home_top" } });
	});

	it("后台路由跳过请求，省掉一次无用的 API 调用", async () => {
		await expect(
			loadTopAdSlot(requestFor("/admin/adverts")),
		).resolves.toBeNull();
		expect(getAdSlotMock).not.toHaveBeenCalled();
	});

	it("接口异常时降级为不展示，不把整页拖挂", async () => {
		getAdSlotMock.mockRejectedValueOnce(new Error("502 Bad Gateway"));

		await expect(loadTopAdSlot(requestFor("/"))).resolves.toBeNull();
	});

	it("站内切页（?_furin=data）不再取数，切页不背一次广告接口往返", async () => {
		const raw = new Request("http://localhost/?_furin=data");
		const result = await requestStorage.run({ request: raw }, () =>
			loadTopAdSlot(requestFor("/")),
		);

		expect(result).toBeNull();
		expect(getAdSlotMock).not.toHaveBeenCalled();
	});

	it("没有 request 时按普通页面处理，不抛错", async () => {
		getAdSlotMock.mockResolvedValueOnce(payload);

		await expect(loadTopAdSlot(undefined)).resolves.toEqual(payload);
	});
});
