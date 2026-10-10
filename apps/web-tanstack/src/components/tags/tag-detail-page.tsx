import { TagGamelist } from "@web/components/home/tag/tagGameList";
import {
	CollapsibleTagList,
	type FlowTag,
} from "@web/components/tags/collapsible-tag-list";
import { Card, CardHeader, CardTitle } from "@web/components/ui/card";

export default function TagDetailPage({ tag }: { tag: any }) {
	const children: FlowTag[] = tag?.children ?? [];
	const description = tag?.zht_description || tag?.description;

	return (
		<>
			<section className="w-full">
				<Card className="w-full">
					<CardHeader>
						<CardTitle className="text-2xl text-center items-center">
							{tag?.zht_name || tag?.name}
						</CardTitle>
						{description && (
							<p className="text-sm text-center text-muted-foreground leading-relaxed">
								{description}
							</p>
						)}
						{children.length > 0 && (
							<CollapsibleTagList
								className="mt-4 border-t border-border/70 pt-4"
								label="子标签"
								tags={children}
							/>
						)}
					</CardHeader>
				</Card>
			</section>

			<div className="text-sm text-center items-center opacity-30 italic">
				相关游戏，过滤自 VNDB
			</div>
			<section>
				<TagGamelist />
			</section>
		</>
	);
}
