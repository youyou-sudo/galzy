import { defineRoute } from "@teyik0/furin";
import ModerationAdminPage, {
	DEFAULT_MODERATION_FILTERS,
	moderationQueueQueryOptions,
} from "@web/components/admin/moderation-page";
import { adminKeys } from "@web/lib/admin/query-keys";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";
import { adminGetModerationSettings } from "@web/server/admin/moderation";
import * as z from "zod/mini";

/**
 * 内容审核后台（大模型识别广告 / 垃圾内容）。
 *
 * 两个 Tab：审核队列（默认）与模型配置；Tab 放进 search，刷新 / 分享可还原。
 * 首屏数据只在文档请求里取（队列 + 配置并发），站内切页交给组件内 useQuery，
 * 切 Tab 走浅层 URL 更新，不触发 furin 导航。
 */

const MODERATION_TABS = ["queue", "settings"] as const;

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

const DEFAULT_QUEUE_QUERY = moderationQueueQueryOptions(
	DEFAULT_MODERATION_FILTERS,
);

export const route = defineRoute("/admin/moderation")
	.config({
		mode: "ssr",
		query: z.object({
			tab: z._default(z.optional(z.enum(MODERATION_TABS)), "queue"),
		}),
	})
	.loader(async ({ request }) => {
		const seed = await documentOnly(request, async () => {
			const [queue, settings] = await Promise.all([
				DEFAULT_QUEUE_QUERY.queryFn(),
				adminGetModerationSettings(),
			]);
			return { queue, settings };
		});
		return {
			queue: seed?.queue ?? null,
			settings: seed?.settings ?? null,
		};
	})
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }))
	.page(({ queue, settings, query }) => (
		<ModerationRoute queue={queue} settings={settings} initialTab={query.tab} />
	));

function ModerationRoute({
	queue,
	settings,
	initialTab,
}: {
	queue: Awaited<ReturnType<typeof DEFAULT_QUEUE_QUERY.queryFn>> | null;
	settings: Awaited<ReturnType<typeof adminGetModerationSettings>> | null;
	initialTab: (typeof MODERATION_TABS)[number];
}) {
	// 文档请求才有数据：等同旧 SSR dehydrate，断言与组件内 useQuery 的键一致；
	// SPA 切页时两者为 null，不 seed，组件自己的 useQuery 会取。
	const seeds: Array<[readonly unknown[], unknown]> = [];
	if (queue) seeds.push([DEFAULT_QUEUE_QUERY.queryKey, queue]);
	if (settings) seeds.push([adminKeys.moderationSettings(), settings]);
	useSeedQueries(seeds);

	return <ModerationAdminPage initialTab={initialTab} />;
}
