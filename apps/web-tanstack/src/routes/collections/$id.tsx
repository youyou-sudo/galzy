import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Skeleton } from "@web/components/ui/skeleton";
import { seoTemplate } from "@web/config/seoTemplate";
import type {
	CollectionData,
	CollectionPreviewGame,
} from "@web/lib/collections";
import { seoMeta, truncateText } from "@web/lib/seo";
import {
	getCollectionById,
	getCollectionPreview,
} from "@web/server/collections";
import { ChevronLeft, Layers, Library } from "lucide-react";

const COLLECTION_SKELETON_KEYS = Array.from(
	{ length: 12 },
	(_, index) => `collection-skeleton-${index}`,
);

export const Route = createFileRoute("/collections/$id")({
	loader: async ({ params }) => {
		const [collection, previews] = await Promise.all([
			getCollectionById({ data: { id: params.id } }),
			getCollectionPreview({ data: { id: params.id, limit: 50 } }).catch(
				() => [],
			),
		]);
		return { collection, previews };
	},
	head: ({ loaderData, params }) =>
		seoMeta({
			title: `${loaderData?.collection?.title || "游戏合集"} | ${seoTemplate.title}`,
			description: loaderData?.collection?.description
				? truncateText(loaderData.collection.description, 150)
				: undefined,
			path: `/collections/${params.id}`,
		}),
	headers: ({ params }) => ({
		"Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
		"Cache-Tag": `collection-${params.id},page-collection-detail`,
	}),
	component: RouteComponent,
	pendingComponent: () => <CollectionDetailSkeleton />,
});

function CollectionDetailSkeleton() {
	return (
		<div className="space-y-8">
			<Breadcrumb className="mb-4">
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
						<BreadcrumbPage>...</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>

			<div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
				<div className="space-y-4 p-6 sm:p-8">
					<div className="flex gap-2">
						<Skeleton className="h-5 w-16 rounded-full" />
						<Skeleton className="h-5 w-20 rounded-full" />
					</div>
					<Skeleton className="h-9 w-1/2" />
					<Skeleton className="h-5 w-3/4" />
					<Skeleton className="h-5 w-1/2" />
				</div>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
				{COLLECTION_SKELETON_KEYS.map((key) => (
					<div key={key} className="space-y-2">
						<Skeleton className="aspect-[2/3] rounded-lg w-full" />
						<Skeleton className="h-4 w-3/4 mx-auto" />
					</div>
				))}
			</div>
		</div>
	);
}

function RouteComponent() {
	const { id } = Route.useParams();
	const loaderData = Route.useLoaderData();

	const { data: collection } = useSuspenseQuery({
		queryKey: ["collection", id],
		queryFn: () => getCollectionById({ data: { id } }),
		initialData: loaderData?.collection,
		staleTime: 30_000,
	});

	const { data: previews } = useSuspenseQuery({
		queryKey: ["collection-preview", id],
		queryFn: () =>
			getCollectionPreview({ data: { id, limit: 50 } }).catch(() => []),
		initialData: loaderData?.previews,
		staleTime: 30_000,
	});

	const coll = collection as CollectionData & { entries?: unknown[] };
	const games = (previews ?? []) as CollectionPreviewGame[];
	const gameCount = coll.entryCount ?? games.length;

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
			<div className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
				{/* Cover mosaic backdrop */}
				{heroCovers.length > 0 && (
					<div className="absolute inset-0 grid grid-cols-4 opacity-25 dark:opacity-20">
						{heroCovers.map((game) => (
							<div key={game.id} className="overflow-hidden">
								<img
									src={game.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
									alt=""
									className="w-full h-full object-cover blur-[2px] scale-110"
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
					<div className="mb-4 flex flex-wrap items-center gap-2.5">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground tabular-nums ring-1 ring-border/60">
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
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
					className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
				>
					<ChevronLeft aria-hidden="true" className="size-4" />
					返回合集列表
				</Link>
			</div>
		</div>
	);
}
