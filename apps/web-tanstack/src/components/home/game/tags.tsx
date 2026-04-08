import { Await, getRouteApi, Link } from "@tanstack/react-router";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "#/components/ui/accordion";
import { Skeleton } from "#/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export function TagsCard() {
	const routeApi = getRouteApi("/$id/_layout");
	const { tags } = routeApi.useLoaderData();

	return (
		<div className="mt-4 mb-5">
			<Accordion type="single" collapsible className="w-full ">
				<AccordionItem value="tags" className="px-3 border rounded-lg">
					<AccordionTrigger className="text-sm opacity-70 hover:opacity-100 py-3">
						游戏标签
					</AccordionTrigger>
					<AccordionContent className="pb-3">
						<Await
							promise={tags}
							fallback={<Skeleton className="w-full h-4" />}
						>
							{(tags) => {
								return tags?.tags?.length === 0 ? null : (
									<div className="flex flex-wrap gap-2">
										{tags?.tags.map(
											(item, i) =>
												item.tag_data && (
													<Badge variant="secondary" key={i}>
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
								);
							}}
						</Await>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}
