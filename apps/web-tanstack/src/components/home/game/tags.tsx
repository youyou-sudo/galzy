import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useDeferredValue } from 'react'
import { Badge } from '@web/components/ui/badge'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@web/components/ui/accordion'
import { getGameTags } from '@web/server/game'

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
	// useQuery 经 useSyncExternalStore 交付更新（同步、默认优先级），数据到达的
	// 重渲染会打断进行中的 View Transition 帧造成掉帧；useDeferredValue 把这次
	// 渲染降为可中断的低优先级，VT 期间先保持骨架，动画结束后再提交。
	const deferredTags = useDeferredValue(tags);

	return (
		<div className="mt-4 mb-5">
			{!deferredTags?.tags?.length ? null : (
				<Accordion className="w-full">
					<AccordionItem value="tags" className="px-3 border rounded-lg">
						<AccordionTrigger className="text-sm opacity-70 hover:opacity-100 py-3">
							游戏标签
						</AccordionTrigger>
						<AccordionContent className="pb-3">
							<div className="flex flex-wrap gap-2">
								{deferredTags?.tags.map(
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