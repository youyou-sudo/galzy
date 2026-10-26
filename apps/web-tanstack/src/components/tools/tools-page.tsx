import { Link } from "@tanstack/react-router";
import { PageHeader } from "@web/components/shared/page-header";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { ExternalLink, Wrench } from "lucide-react";

const toolLinks = [
	{
		to: "/tools/plate",
		icon: ExternalLink,
		title: "车牌号跳转",
		description: "输入车牌号，快速跳转到 nhentai、禁漫天堂、Hitomi.la 等网站",
	},
];

/** 工具索引：页头用统一 PageHeader，卡片沿用顶栏的圆角 + 发丝边语言。 */
export default function RouteComponent() {
	return (
		<section className="mx-auto w-full max-w-3xl py-6">
			<PageHeader
				align="center"
				icon={Wrench}
				title="工具箱"
				description="Galgame 常用工具集合，让资源查找和社区访问更便捷"
			/>

			<div className="grid gap-4 sm:grid-cols-2">
				{toolLinks.map(({ to, icon: Icon, title, description }) => (
					<Link
						key={to}
						to={to}
						className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					>
						<Card className="h-full transition-colors duration-200 group-hover:bg-muted/40 group-hover:ring-border">
							<CardHeader className="gap-2">
								<CardTitle className="flex items-center gap-3 text-base font-medium">
									<span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
										<Icon className="size-4" />
									</span>
									{title}
								</CardTitle>
								<CardDescription className="pl-12 text-sm leading-relaxed">
									{description}
								</CardDescription>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</section>
	);
}
