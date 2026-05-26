import { Await, getRouteApi, Link } from "@tanstack/react-router";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@web/components/ui/accordion";
import { Skeleton } from "@web/components/ui/skeleton";
import { Badge } from "@web/components/ui/badge";

export function TagsCard() {
	const routeApi = getRouteApi("/$id/_layout");
	const { tags } = routeApi.useLoaderData();

	return (
		<div className="mt-4 mb-5">
			<Await promise={tags} fallback={<Skeleton className="w-full h-10" />}>
				{(tags) => {
					return tags?.tags?.length === 0 ? null : (
						<Accordion type="single" collapsible className="w-full ">
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
					);
				}}
			</Await>
		</div>
	);
}
