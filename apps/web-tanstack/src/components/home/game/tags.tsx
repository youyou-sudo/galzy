import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Badge } from '@web/components/ui/badge'
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@web/components/ui/accordion'
import { getGameTags } from '@web/server/game'

export function TagsCard() {
	const routeApi = getRouteApi('/$id/_layout');
	const { id } = routeApi.useLoaderData();
	const { data: tags } = useQuery({
		queryKey: ['gameTags', id],
		queryFn: () => getGameTags({ data: { id } }),
		staleTime: 60_000,
	});

	return (
		<div className="mt-4 mb-5">
			{!tags?.tags?.length ? null : (
				<Accordion className="w-full">
					<AccordionItem value="tags" className="px-3 border rounded-lg">
						<AccordionTrigger className="text-sm opacity-70 hover:opacity-100 py-3">
							游戏标签
						</AccordionTrigger>
						<AccordionContent className="pb-3">
							<div className="flex flex-wrap gap-2">
								{tags?.tags.map(
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