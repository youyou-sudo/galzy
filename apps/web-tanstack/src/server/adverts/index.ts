import { api } from "@libs";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { type AdSlotPayload, adSlotQueryKey } from "@web/lib/adverts";
import { elysiaErrorF } from "@web/lib/elysia-error";
import * as z from "zod/mini";

/**
 * 公开：按广告位 key 取「当前在投」的广告素材。
 *
 * 返回 { slot, desktop[], mobile[] }：设备过滤、maxItems 上限与权重轮换都在 API 侧
 * 完成（行业做法：定向与轮换属于投放逻辑，不交给浏览器）。广告位不存在或已停用返回 null。
 */
export const getAdSlot = createServerFn({ method: "GET" })
	.validator(z.object({ key: z.string().check(z.minLength(1)) }))
	.handler(async ({ data }) => {
		const { data: payload, error } = await api.adverts
			.slot({ key: data.key })
			.get();
		elysiaErrorF(error);
		return (payload ?? null) as unknown as AdSlotPayload | null;
	});

/** 曝光 / 点击上报：失败不影响页面，调用方一律 fire-and-forget。 */
export const trackAdvert = createServerFn({ method: "POST" })
	.validator(
		z.object({
			id: z.number(),
			type: z.enum(["impression", "click"]),
		}),
	)
	.handler(async ({ data }) => {
		const { error } = await api.adverts.track.post(data);
		// 统计是尽力而为：这里刻意不调 elysiaErrorF —— 该约定针对「用户可见的数据请求」，
		// 而统计失败不应触发 401 跳转或整页错误；调用方也一律 fire-and-forget。
		if (error) return { success: false };
		return { success: true };
	});

/**
 * 根布局 beforeLoad 预取 + 广告位组件 useQuery 共用同一份 queryOptions：
 * SSR 首帧直接出广告（无布局跳动），客户端 60s 内不重复请求，
 * 后台改动最多 60s 后在前台生效（与 API 侧广告位缓存 TTL 对齐）。
 */
export const adSlotQueryOptions = (key: string) =>
	queryOptions({
		queryKey: adSlotQueryKey(key),
		queryFn: async () =>
			(await getAdSlot({ data: { key } })) as unknown as AdSlotPayload | null,
		staleTime: 60_000,
		// 广告只是装饰位：接口异常时安静地不展示，不能把整页导航拖挂
		retry: false,
	});
