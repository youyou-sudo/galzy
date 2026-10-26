import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
	SectionHeader,
	sectionActionClass,
} from "@web/components/shared/section-header";
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
		<SectionHeader
			icon={BookOpen}
			title="精选合集"
			action={
				<Link
					to="/collections"
					search={{ page: 1 }}
					className={sectionActionClass}
				>
					更多合集 →
				</Link>
			}
		/>
	);
}

export function CollectionsSection() {
	const showR18 = useSelector(r18Store, (s) => s.showR18);
	// 刻意不用 Suspense / useSuspenseQuery：SSR 阶段一旦挂起，整页 HTML 都要等这份
	// 数据（合集预览是最重的一个接口），首字节会被它拖住。普通 useQuery 让服务端
	// 先出「区块外壳 + 卡片骨架」，数据在客户端补齐。
	const { data: collections, isLoading } = useQuery({
		queryKey: ["homeCollections", showR18],
		queryFn: () =>
			getCollectionsWithPreview({
				data: { limit: 6, previewLimit: 3, showR18 },
			}).then((r) => r.items),
		staleTime: 5 * 60_000,
	});

	// 切换/冷启动拉取窗口期显示骨架，避免整块空白
	if (isLoading) return <CollectionsSectionSkeleton />;

	if (!collections || collections.length === 0) return null;

	return (
		<section className="mb-8">
			<CollectionsSectionHeader />
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
				{COLLECTION_SKELETON_KEYS.map((key) => (
					<CollectionItemSkeleton key={key} />
				))}
			</div>
		</section>
	);
}
