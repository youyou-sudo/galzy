import { defineRoute } from "@teyik0/furin";
import TopicsPage, {
	DEFAULT_TOPICS_FILTERS,
	topicsQueryOptions,
} from "@web/components/admin/topics-page";
import { useSeedQueries } from "@web/lib/query-seed";
import { seoMeta } from "@web/lib/seo";
import { documentOnly } from "@web/lib/spa-request";

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

/** 论坛话题管理（等价旧 `routes/admin/_authL/topics.tsx`）。 */
const DEFAULT_QUERY = topicsQueryOptions(DEFAULT_TOPICS_FILTERS);

/** 首屏数据只在文档请求里取，站内切页交给页面内 useQuery（见 `@web/lib/spa-request`）。 */
export const route = defineRoute("/admin/topics")
	.config({ mode: "ssr" })
	.loader(async ({ request }) => ({
		topics: await documentOnly(request, () => DEFAULT_QUERY.queryFn()),
	}))
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }))
	.page(({ topics }) => <TopicsRoute topics={topics} />);

function TopicsRoute({
	topics,
}: {
	topics: Awaited<ReturnType<typeof DEFAULT_QUERY.queryFn>> | null;
}) {
	useSeedQueries(topics ? [[DEFAULT_QUERY.queryKey, topics]] : []);
	return <TopicsPage />;
}
