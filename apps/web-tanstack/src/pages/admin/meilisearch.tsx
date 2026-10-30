import { defineRoute } from "@teyik0/furin";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { EmbeddersTab } from "@web/components/admin/meilisearch/embedders-tab";
import { IndexesTab } from "@web/components/admin/meilisearch/indexes-tab";
import { OverviewTab } from "@web/components/admin/meilisearch/overview-tab";
import { PropertiesTab } from "@web/components/admin/meilisearch/properties-tab";
import { SearchableTab } from "@web/components/admin/meilisearch/searchable-tab";
import type { IndexType } from "@web/components/admin/meilisearch/types";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@web/components/ui/tabs";
import { useNavigate } from "@web/lib/nav";
import { seoMeta } from "@web/lib/seo";
import { BracesIcon, DatabaseIcon, ListIcon, SearchIcon, ServerIcon } from "lucide-react";
import { useState } from "react";
import * as z from "zod/mini";

/**
 * Meilisearch 管理（等价旧 `routes/admin/_authL/meilisearch.tsx`）。
 *
 * indexType / tab 放进 URL（旧 validateSearch 的 zod schema 原样搬进 config.query），
 * 旧路由的 Route.useSearch/useNavigate 换成页面 props 的 query + @web/lib/nav。
 */

const MEILI_TABS = [
	"overview",
	"embedders",
	"searchable",
	"properties",
	"indexes",
] as const;

type MeiliTab = (typeof MEILI_TABS)[number];

const meiliSearchSchema = z.object({
	indexType: z._default(
		z.optional(z.enum(["game", "tag", "producer"])),
		"game",
	),
	tab: z._default(z.optional(z.enum(MEILI_TABS)), "overview"),
});

type MeiliSearch = z.infer<typeof meiliSearchSchema>;

const ADMIN_TITLE = "管理后台 | GalZY - Galgame 资源站";

export const route = defineRoute("/admin/meilisearch")
	.config({ mode: "ssr", query: meiliSearchSchema })
	.head(() => seoMeta({ title: ADMIN_TITLE, noindex: true }) as never)
	.page(({ query }) => <MeilisearchPage query={query} />);

function MeilisearchPage({ query }: { query: MeiliSearch }) {
	const { indexType, tab } = query;
	const navigate = useNavigate();

	// 只挂载访问过的标签页：切回来时组件不卸载，查询缓存与滚动位置都还在，
	// 不会每次都闪一次骨架。
	const [visitedTabs, setVisitedTabs] = useState<Set<MeiliTab>>(
		() => new Set<MeiliTab>([tab]),
	);

	/** 合并式改 URL：与旧 Route.useNavigate 的 search reducer 等价。 */
	const patchSearch = (
		patch: Partial<MeiliSearch>,
		options?: { replace?: boolean },
	) => {
		void navigate({
			to: "/admin/meilisearch",
			search: { ...query, ...patch },
			replace: options?.replace,
		});
	};

	const handleTabChange = (value: string | number | null) => {
		if (typeof value !== "string") return;
		const nextTab = value as MeiliTab;
		setVisitedTabs((previous) => {
			if (previous.has(nextTab)) return previous;
			const next = new Set(previous);
			next.add(nextTab);
			return next;
		});
		patchSearch({ tab: nextTab }, { replace: true });
	};

	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={DatabaseIcon}
				eyebrow="系统"
				title="Meilisearch 管理"
				description="管理 Meilisearch 搜索引擎的配置与索引"
				actions={
					<Select
						value={indexType}
						onValueChange={(value) =>
							patchSearch({ indexType: value as IndexType })
						}
					>
						<SelectTrigger size="sm" className="w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="game">游戏索引</SelectItem>
							<SelectItem value="tag">标签索引</SelectItem>
							<SelectItem value="producer">厂商索引</SelectItem>
						</SelectContent>
					</Select>
				}
			/>

			<Tabs value={tab} onValueChange={handleTabChange} className="w-full">
				<div className="overflow-x-auto pb-[5px] -mb-[5px] max-w-full">
					<TabsList variant="line">
						<TabsTrigger value="overview">
							<ServerIcon className="size-4" />
							概览
						</TabsTrigger>
						<TabsTrigger value="embedders">
							<BracesIcon className="size-4" />
							Embedders
						</TabsTrigger>
						<TabsTrigger value="searchable">
							<SearchIcon className="size-4" />
							搜索属性
						</TabsTrigger>
						<TabsTrigger value="properties">
							<ListIcon className="size-4" />
							属性列表
						</TabsTrigger>
						<TabsTrigger value="indexes">
							<DatabaseIcon className="size-4" />
							索引管理
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="overview" keepMounted className="mt-4">
					{visitedTabs.has("overview") && <OverviewTab />}
				</TabsContent>
				<TabsContent value="embedders" keepMounted className="mt-4">
					{visitedTabs.has("embedders") && <EmbeddersTab />}
				</TabsContent>
				<TabsContent value="searchable" keepMounted className="mt-4">
					{visitedTabs.has("searchable") && (
						<SearchableTab indexType={indexType} />
					)}
				</TabsContent>
				<TabsContent value="properties" keepMounted className="mt-4">
					{visitedTabs.has("properties") && (
						<PropertiesTab indexType={indexType} />
					)}
				</TabsContent>
				<TabsContent value="indexes" keepMounted className="mt-4">
					{visitedTabs.has("indexes") && <IndexesTab />}
				</TabsContent>
			</Tabs>
		</div>
	);
}
