import { defineRoute } from "@teyik0/furin";
import { t } from "elysia";
import { GameCard } from "@web/components/home/card";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import { EmptyState } from "@web/components/shared/empty-state";
import { SectionHeader } from "@web/components/shared/section-header";
import { Button } from "@web/components/ui/button";
import { seoTemplate } from "@web/config/seoTemplate";
import type {
	CollectionData,
	CollectionPreviewGame,
} from "@web/lib/collections";
import { Link } from "@web/lib/nav";
import { seoMeta, truncateText } from "@web/lib/seo";
import {
	getCollectionById,
	getCollectionPreview,
} from "@web/server/collections";
import { ChevronLeft, Layers, Library } from "lucide-react";

const paramsSchema = t.Object({ id: t.String() });

export const route = defineRoute("/collections/[id]")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => {
		const [collection, previews] = await Promise.all([
			getCollectionById({ data: { id: params.id } }),
			getCollectionPreview({ data: { id: params.id, limit: 50 } }).catch(
				() => [],
			),
		]);
		// BFF 返回类型被收敛为 unknown，这里按页面实际消费的形状显式定型
		return { collection, previews };
	})
	.head(
		({ collection, params }) =>
			seoMeta({
				title: `${collection?.title || "游戏合集"} | ${seoTemplate.title}`,
				description: collection?.description
					? truncateText(collection.description, 150)
					: undefined,
				path: `/collections/${params.id}`,
			}) as unknown as never,
	)
	.page(({ collection, previews }) => (
		<CollectionDetail
			collection={collection as (CollectionData & { entries?: unknown[] }) | null}
			previews={previews as CollectionPreviewGame[]}
		/>
	));

function CollectionDetail({
	collection,
	previews,
}: {
	collection: (CollectionData & { entries?: unknown[] }) | null;
	previews: CollectionPreviewGame[];
}) {
	const coll = collection;
	const games = previews ?? [];
	const gameCount = coll?.entryCount ?? games.length;

	// First 4 covers for hero mosaic
	const heroCovers = games.slice(0, 4);

	if (!coll) {
		return (
			<EmptyState
				icon={Library}
				title="合集不存在"
				description="该合集可能已被删除，回合集列表看看其他精选吧"
				action={
					<Button
						variant="outline"
						size="sm"
						render={<Link to="/collections" search={{ page: 1 }} />}
					>
						返回合集列表
					</Button>
				}
			/>
		);
	}

	return (
		<div className="space-y-10">
			{/* Breadcrumb */}
			<Breadcrumb className="mb-2">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink
							render={<Link to="/collections" search={{ page: 1 }} />}
						>
							合集
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{coll.title}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			{/* Hero Section：保留封面拼贴与 View Transition，外壳换成发丝边大圆角 */}
			<div className="overflow-hidden relative bg-card rounded-2xl ring-1 ring-border/60">
				{/* Cover mosaic backdrop */}
				{heroCovers.length > 0 && (
					<div className="grid absolute inset-0 grid-cols-4 opacity-25 dark:opacity-20">
						{heroCovers.map((game) => (
							<div key={game.id} className="overflow-hidden">
								<img
									src={game.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
									alt=""
									className="object-cover w-full h-full blur-[2px] scale-110"
									loading="lazy"
								/>
							</div>
						))}
					</div>
				)}

				{/* Gradient overlay — lighter to let mosaic through */}
				<div className="absolute inset-0 bg-gradient-to-br from-card/40 via-card/70 to-card/90" />

				{/* Content */}
				<div className="relative p-6 sm:p-8 md:p-10">
					<div className="flex flex-wrap gap-2.5 items-center mb-4">
						<span className="inline-flex gap-1.5 items-center px-2.5 py-1 text-xs tabular-nums text-muted-foreground bg-muted/60 rounded-full ring-1 ring-border/60">
							<Layers aria-hidden="true" className="size-3.5" />
							{gameCount} 部作品
						</span>
					</div>

					<h1 className="mb-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
						{coll.title}
					</h1>

					{coll.description && (
						<p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
							{coll.description}
						</p>
					)}
				</div>
			</div>

			{/* Game Grid Section */}
			<section>
				<SectionHeader
					icon={Layers}
					title="收录作品"
					count={`共 ${gameCount} 部`}
					className="mb-6"
				/>

				{games.length > 0 ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
						{games.map((game) => (
							<GameCard.Item
								key={game.id}
								gameid={game.id}
								title={game.title ?? game.alias ?? game.id}
								width={game.imageWidth ?? 200}
								height={game.imageHeight ?? 300}
								thumbhash={game.imageThumbhash}
								src={game.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
								cSexualAvg={game.cSexualAvg}
							/>
						))}
					</div>
				) : (
					<EmptyState
						icon={Library}
						title="暂无收录作品"
						description="该合集还没有收录作品"
						surface
						size="sm"
					/>
				)}
			</section>

			{/* Back link */}
			<div className="pt-2">
				<Link
					to="/collections"
					search={{ page: 1 }}
					className="inline-flex gap-1.5 items-center text-sm text-muted-foreground rounded-sm transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<ChevronLeft aria-hidden="true" className="size-4" />
					返回合集列表
				</Link>
			</div>
		</div>
	);
}
