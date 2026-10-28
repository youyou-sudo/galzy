import { createFileRoute } from "@tanstack/react-router";
import AdvertsAdminPage from "@web/components/admin/adverts-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { adminGetAdSlots, adminGetAdverts } from "@web/server/admin/adverts";
import * as z from "zod/mini";

/**
 * 广告位后台路由。
 *
 * 页面有「广告位」「广告素材」两个 Tab，把当前 Tab 放进 search 参数，
 * 刷新 / 分享链接都能回到同一个视图（与 Meilisearch 后台一致）。
 * loader 同时预取两份数据：广告位列表（筛选器与广告位 Tab 共用）与全部素材，
 * 两个 Tab 首屏都不出现骨架回退。
 */

const AD_TABS = ["slots", "adverts"] as const;

export const Route = createFileRoute("/admin/_authL/adverts")({
	validateSearch: z.object({
		tab: z._default(z.optional(z.enum(AD_TABS)), "slots"),
	}),
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData({
				queryKey: adminKeys.adSlots(),
				queryFn: async () => await adminGetAdSlots({ data: {} }),
			}),
			context.queryClient.ensureQueryData({
				queryKey: adminKeys.adverts(null),
				queryFn: async () => await adminGetAdverts({ data: {} }),
			}),
		]);
	},
	component: AdvertsAdminPage,
});
