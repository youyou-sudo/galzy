import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
	CollapsibleTagList,
	type FlowTag,
} from "@web/components/tags/collapsible-tag-list";
import { waitForViewTransitionEnd } from "@web/lib/view-transition";
import { getGameTags } from "@web/server/game";
import { useEffect, useState } from "react";

// queryOptions 提取：供 /$id/_layout loader 在导航关键路径上 prefetchQuery 预热，
// 与组件内 useQuery 共用同一 queryKey/queryFn，首次进入即缓存命中。
export const gameTagsQueryOptions = (id: string) => ({
	queryKey: ["gameTags", id],
	queryFn: () => getGameTags({ data: { id } }),
	staleTime: 60_000,
});

export function TagsCard() {
	const routeApi = getRouteApi("/$id/_layout");
	const { id } = routeApi.useLoaderData();
	const { data: tags } = useQuery(gameTagsQueryOptions(id));
	// VT 结束 gate：数据到达时若正处 View Transition 动画中，先保持骨架，
	// 等 waitForViewTransitionEnd() resolve 再提交渲染 —— VT 进行中的重渲染
	// 会打断动画帧；useDeferredValue 只降优先级，不保证等动画结束。
	// 初值取当前 tags：SSR/无 VT 时直接渲染，且与 SSR 输出一致（无 hydration 抖动）。
	const [settledTags, setSettledTags] = useState(tags);
	useEffect(() => {
		if (tags === undefined) return;
		let cancelled = false;
		void waitForViewTransitionEnd().then(() => {
			if (!cancelled) setSettledTags(tags);
		});
		return () => {
			cancelled = true;
		};
	}, [tags]);

	// 顺序原样透传接口返回，不做任何排序/去重，保持旧实现的展示逻辑
	const flowTags: FlowTag[] = (settledTags?.tags ?? [])
		.map((item: any) => item.tag_data)
		.filter(Boolean);

	return (
		<div className="mt-4 mb-5">
			{!flowTags.length ? null : (
				<CollapsibleTagList tags={flowTags} preload="viewport" />
			)}
		</div>
	);
}
