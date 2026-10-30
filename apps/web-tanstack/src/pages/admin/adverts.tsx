import { defineRoute } from "@teyik0/furin";
import AdvertsAdminPage from "@web/components/admin/adverts-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { adminGetAdSlots, adminGetAdverts } from "@web/server/admin/adverts";
import * as z from "zod/mini";

/**
 * 广告位后台（等价旧 `routes/admin/_authL/adverts.tsx`）。
 *
 * 页面有「广告位」「广告素材」两个 Tab，当前 Tab 放进 search 参数，
 * 刷新 / 分享链接都能回到同一个视图（与 Meilisearch 后台一致）。
 * loader 同时取广告位列表（筛选器与广告位 Tab 共用）与全部素材，
 * 由 useSeedQueries 灌进 React Query 缓存，两个 Tab 首屏都不出现骨架回退。
 */

const AD_TABS = ["slots", "adverts"] as const;

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

export const route = defineRoute("/admin/adverts")
	.config({
		mode: "ssr",
		query: z.object({
			tab: z._default(z.optional(z.enum(AD_TABS)), "slots"),
		}),
	})
	.loader(async () => {
		const [slots, adverts] = await Promise.all([
			adminGetAdSlots({ data: {} }),
			adminGetAdverts({ data: {} }),
		]);
		return { slots, adverts };
	})
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ slots, adverts }) => (
		<AdvertsPage slots={slots} adverts={adverts} />
	));

function AdvertsPage({
	slots,
	adverts,
}: {
	slots: Awaited<ReturnType<typeof adminGetAdSlots>>;
	adverts: Awaited<ReturnType<typeof adminGetAdverts>>;
}) {
	// 等同旧 SSR dehydrate：断言与组件内 useQuery 的键一致，首屏直接命中
	useSeedQueries([
		[adminKeys.adSlots(), slots],
		[adminKeys.adverts(null), adverts],
	]);

	return <AdvertsAdminPage />;
}
