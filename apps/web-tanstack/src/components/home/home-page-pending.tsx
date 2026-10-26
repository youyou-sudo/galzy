import CountComponent from "@web/components/home/Count";
import { CollectionsSectionSkeleton } from "@web/components/home/collections-section";
import { HomeHero } from "@web/components/home/home-hero";
import { HotGamesSectionSkeleton } from "@web/components/home/hot-games-section";
import { HotTagsSectionSkeleton } from "@web/components/home/hot-tags-section";
import SearchInput from "@web/components/home/search/Search";

/**
 * 首页 pending 态：外壳固定，只有各区块的内容出加载态。
 *
 * 标题、防失联 Badge、计数文案、搜索栏、三个区块的标题行与「更多 →」链接
 * 全部是真实 HTML；只有标签药丸、热游卡片、合集卡片、收录数字各自出骨架。
 * JSX 顺序与容器 class 与 routes/index.tsx 里的 App 完全一致，数据到达时
 * 只替换内容，不会出现整页重排或标题二次闪动。
 */
export function HomePagePending() {
	return (
		<>
			<HomeHero />

			{/* 计数文案固定，只有数字走 Count 内部的 Suspense 兜底 */}
			<CountComponent />

			<div className="mx-auto mt-6 mb-8 w-full max-w-2xl px-1">
				<SearchInput />
			</div>

			<HotTagsSectionSkeleton />

			<HotGamesSectionSkeleton />

			<CollectionsSectionSkeleton />
		</>
	);
}
