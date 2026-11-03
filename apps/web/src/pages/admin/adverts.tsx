import { defineRoute } from "@teyik0/furin";
import AdvertsAdminPage from "@web/components/admin/adverts-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";
import { adminGetAdSlots, adminGetAdverts } from "@web/server/admin/adverts";
import * as z from "zod/mini";

/**
 * 广告位后台（等价旧 `routes/admin/_authL/adverts.tsx`）。
 *
 * 页面有「广告位」「广告素材」两个 Tab，当前 Tab 放进 search 参数，
 * 刷新 / 分享链接都能回到同一个视图（与 Meilisearch 后台一致）；
 * 但页内切 Tab 走浅层 URL 更新，不触发 furin 导航（见 AdvertsAdminPage）。
 *
 * 首屏数据只在文档请求里取：直链/刷新时 SSR 带着数据进水合，两个 Tab 首屏都
 * 不闪骨架；站内切页 loader 返回 null，交给组件里的 useQuery 客户端加载。
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
	.loader(async ({ request }) => {
		const seed = await documentOnly(request, async () => {
			const [slots, adverts] = await Promise.all([
				adminGetAdSlots({ data: {} }),
				adminGetAdverts({ data: {} }),
			]);
			return { slots, adverts };
		});
		return { slots: seed?.slots ?? null, adverts: seed?.adverts ?? null };
	})
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }))
	.page(({ slots, adverts, query }) => (
		<AdvertsPage slots={slots} adverts={adverts} initialTab={query.tab} />
	));

function AdvertsPage({
	slots,
	adverts,
	initialTab,
}: {
	slots: Awaited<ReturnType<typeof adminGetAdSlots>> | null;
	adverts: Awaited<ReturnType<typeof adminGetAdverts>> | null;
	initialTab: (typeof AD_TABS)[number];
}) {
	// 文档请求才有数据：等同旧 SSR dehydrate，断言与组件内 useQuery 的键一致；
	// SPA 切页时两者为 null，不 seed，组件自己的 useQuery 会取。
	const seeds: Array<[readonly unknown[], unknown]> = [];
	if (slots) seeds.push([adminKeys.adSlots(), slots]);
	if (adverts) seeds.push([adminKeys.adverts(null), adverts]);
	useSeedQueries(seeds);

	return <AdvertsAdminPage initialTab={initialTab} />;
}
