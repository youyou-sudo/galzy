import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { getCollectionsWithPreview } from "@web/server/collections";
import { r18Store } from "@web/stores/r18Store";
import { BookOpen } from "lucide-react";
import { CollectionItem, CollectionItemSkeleton } from "./collection-card";

// 骨架数量与真实区块一屏可见的卡片数一致（2/3/6 列栅格各一整行）
const COLLECTION_SKELETON_KEYS = Array.from(
	{ length: 6 },
	(_, index) => `collection-skeleton-${index}`,
);

/**
 * 精选合集区块的标题行（图标 + 「精选合集」+「更多合集 →」）。
 *
 * 真实区块、切 R18 时的加载态与首页 pending 骨架共用，标题行始终是真实 HTML。
 */
export function CollectionsSectionHeader() {
	return (
		<div className="flex items-center justify-between mb-4">
			<div className="flex items-center gap-2">
				<BookOpen className="size-5 text-primary" />
				<h2 className="text-xl font-semibold">精选合集</h2>
			</div>
			<Link
				to="/collections"
				search={{ page: 1 }}
				className="text-sm text-muted-foreground hover:text-primary transition-colors"
			>
				更多合集 →
			</Link>
		</div>
	);
}

export function CollectionsSection() {
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	const { data: collections, isLoading } = useQuery({
		queryKey: ["homeCollections", showR18],
		queryFn: () =>
			getCollectionsWithPreview({
				data: { limit: 5, previewLimit: 3, showR18 },
			}).then((r) => r.items),
		staleTime: 5 * 60_000,
	});

	// 切换/冷启动拉取窗口期显示骨架，避免整块空白
	if (isLoading) return <CollectionsSectionSkeleton />;

	if (!collections || collections.length === 0) return null;

	return (
		<section className="mb-8">
			<CollectionsSectionHeader />
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
				{collections.map((col) => (
					<CollectionItem key={col.id} collection={col} />
				))}
			</div>
		</section>
	);
}

// pending 期间外壳固定：标题行与「更多合集 →」是真实 HTML，只有卡片内容出加载态
export function CollectionsSectionSkeleton() {
	return (
		<section className="mb-8">
			<CollectionsSectionHeader />
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
				{COLLECTION_SKELETON_KEYS.map((key) => (
					<CollectionItemSkeleton key={key} />
				))}
			</div>
		</section>
	);
}
