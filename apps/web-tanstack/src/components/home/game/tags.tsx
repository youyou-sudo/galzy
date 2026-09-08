import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Badge } from '@web/components/ui/badge'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@web/components/ui/accordion'
import { getGameTags } from '@web/server/game'
import { waitForViewTransitionEnd } from '@web/lib/view-transition'

// queryOptions 提取：供 /$id/_layout loader 在导航关键路径上 prefetchQuery 预热，
// 与组件内 useQuery 共用同一 queryKey/queryFn，首次进入即缓存命中。
export const gameTagsQueryOptions = (id: string) => ({
	queryKey: ['gameTags', id],
	queryFn: () => getGameTags({ data: { id } }),
	staleTime: 60_000,
});

export function TagsCard() {
	const routeApi = getRouteApi('/$id/_layout');
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

	return (
		<div className="mt-4 mb-5">
			{!settledTags?.tags?.length ? null : (
				<Accordion className="w-full">
					<AccordionItem value="tags" className="px-3 border rounded-lg">
						<AccordionTrigger className="text-sm opacity-70 hover:opacity-100 py-3">
							游戏标签
						</AccordionTrigger>
						<AccordionContent className="pb-3">
							<div className="flex flex-wrap gap-2">
								{settledTags?.tags.map(
									(item) =>
										item.tag_data && (
											<Badge variant="secondary" key={item.tag_data.id}>
												<Link
													to={"/tags/$tagId"}
													params={{ tagId: item.tag_data.id }}
													preload="viewport"
													className="no-underline opacity-70"
												>
													{item.tag_data?.zht_name || item.tag_data?.name}
												</Link>
											</Badge>
										),
								)}
							</div>
						</AccordionContent>
					</AccordionItem>
				</Accordion>
			)}
		</div>
	);
}