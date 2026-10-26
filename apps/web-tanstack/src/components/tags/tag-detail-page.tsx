import { BBCodeRenderer } from "@web/components/bbcode";
import { TagGamelist } from "@web/components/home/tag/tagGameList";
import {
	CollapsibleTagList,
	type FlowTag,
} from "@web/components/tags/collapsible-tag-list";
import { TagHierarchy } from "@web/components/tags/tag-hierarchy";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@web/components/ui/tabs";
import { Network, Tags } from "lucide-react";
import { useState } from "react";

export default function TagDetailPage({ tag }: { tag: any }) {
	const children: FlowTag[] = tag?.children ?? [];
	const description = tag?.zht_description || tag?.description;
	// 平铺的子标签和层级关系图是同一份父子关系的两种读法，收进一个页签里切换。
	// 默认停在「子标签」：多数人是来找某个具体子标签的，关系图按需切过去。
	const [tab, setTab] = useState("children");
	const hasChildren = children.length > 0;

	return (
		<>
			<section className="w-full">
				<Card className="w-full">
					<CardHeader>
						<CardTitle className="text-2xl text-center items-center">
							{tag?.zht_name || tag?.name}
						</CardTitle>
						{description && (
							<div className="text-sm text-muted-foreground leading-relaxed">
								<BBCodeRenderer text={description} />
							</div>
						)}
					</CardHeader>

					{/* 页签搬进介绍卡片里：标签名、介绍、子标签、层级关系说的都是同一个标签，
					    拆成两张卡会读成两块不相干的内容。 */}
					<CardContent>
						<Tabs
							// 没有子标签时「子标签」页签不渲染，选中态只能落在关系图上，
							// 否则会停在一个不存在的面板上、整块空掉。
							value={hasChildren ? tab : "hierarchy"}
							onValueChange={setTab}
							className="w-full"
						>
							<TabsList className="h-8">
								{hasChildren && (
									<TabsTrigger value="children">
										<Tags className="size-3.5" />
										子标签
										<span className="text-muted-foreground text-xs tabular-nums">
											{children.length}
										</span>
									</TabsTrigger>
								)}
								<TabsTrigger value="hierarchy">
									<Network className="size-3.5" />
									标签层级关系
								</TabsTrigger>
							</TabsList>

							{hasChildren && (
								<TabsContent value="children">
									<CollapsibleTagList tags={children} />
								</TabsContent>
							)}

							<TabsContent value="hierarchy">
								<TagHierarchy tag={tag} />
							</TabsContent>
						</Tabs>
					</CardContent>
				</Card>
			</section>

			<div className="mt-6 mb-3 text-center text-xs text-muted-foreground">
				相关游戏，过滤自 VNDB
			</div>
			<section>
				<TagGamelist />
			</section>
		</>
	);
}
