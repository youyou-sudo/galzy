import { Link } from "@tanstack/react-router";
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

export default function RouteComponent() {
	return (
		<section className="flex justify-center items-start min-h-[60vh]">
			<div className="w-full max-w-3xl">
				{/* Header */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center size-12 rounded-full bg-primary/10 mb-4">
						<Wrench className="size-6 text-primary" />
					</div>
					<h1 className="text-3xl font-bold mb-2">工具箱</h1>
					<p className="text-muted-foreground max-w-md mx-auto">
						Galgame 常用工具集合，让资源查找和社区访问更便捷
					</p>
				</div>

				{/* Tool Cards Grid */}
				<div className="grid gap-4 sm:grid-cols-2">
					{toolLinks.map(({ to, icon: Icon, title, description }) => (
						<Link key={to} to={to} className="group">
							<Card className="h-full transition-all hover:bg-accent/50 hover:border-primary/20">
								<CardHeader>
									<CardTitle className="flex items-center gap-3 text-lg">
										<span className="inline-flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
											<Icon className="size-4" />
										</span>
										{title}
									</CardTitle>
									<CardDescription className="text-sm leading-relaxed pl-12">
										{description}
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					))}
				</div>
			</div>
		</section>
	);
}
