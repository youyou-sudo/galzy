import { MotionHighlight } from "@web/components/animate-ui/effects/motion-highlight";
import { PageHeader } from "@web/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Card } from "@web/components/ui/card";
import { HeartHandshake } from "lucide-react";
import { MotionConfig } from "motion/react";

const linksList: {
	title: string;
	avatar: string;
	href: string;
	description: string;
}[] = [
	{
		title: "莱茵",
		avatar: "/telegram.png",
		href: "https://t.me/RhineLibrary",
		description: "一个 Telegram Galgame 资源频道",
	},
	{
		title: "Steam 上的中文 Galgame",
		avatar:
			"https://steamgalgame.com/usr/themes/SteamGalgame/static/img/favicon.png",
		href: "https://steamgalgame.com",
		description: "",
	},
	{
		title: "莉斯坦 ACG",
		avatar: "https://www.limulu.moe/favicon.ico",
		href: "https://www.limulu.moe",
		description: "一个简洁美观人性化的 ACG 资源站",
	},
	{
		title: "梓澪の妙妙屋",
		avatar: "https://gal.games/favicon.ico?favicon.3wygzhz2hpu11.ico",
		href: "https://gal.games",
		description: "梓澪の妙妙屋 - Galgame 资源库",
	},
	{
		title: "鲲 Galgame 论坛",
		avatar: "https://www.kungal.com/favicon.ico",
		href: "https://www.kungal.com",
		description: "世界上最萌的 Galgame 论坛! ",
	},
	{
		title: "Hikarinagi",
		avatar: "https://www.hikarinagi.org/favicon.ico",
		href: "https://www.hikarinagi.org",
		description: "Hikarinagi 致力于为所有ACG爱好者提供一个交流和分享的平台! ",
	},
	{
		title: "TouchGal",
		avatar:
			"https://cloud.touchgaloss.com/2024/06/8b9411844520240614204452.webp",
		href: "https://www.touchgal.ink",
		description:
			"TouchGal 是一个一站式 Galgame 文化社区。提供Galgame 论坛、Galgame 下载等服务。承诺永久免费, 高质量。为Galgame 爱好者提供一片净土！",
	},
	{
		title: "缘汐馆",
		avatar:
			"https://cloudflareimgbed.mrqyj.qzz.io/file/%E7%BD%91%E7%AB%99%E7%9B%B8%E5%85%B3%E5%9B%BE%E6%A0%87/1788319940785_%E5%9B%BE%E6%A0%87.png",
		href: "https://yxggal.top",
		description: "",
	},
];

export default function RouteComponent() {
	// 局部包裹（不再由全站 Provider 包裹）：reducedMotion="user" 让 motion 组件跟随
	// 系统「减弱动态效果」设置，同时避免 motion/react 进入全站首屏 chunk。
	return (
		<MotionConfig reducedMotion="user">
			<section className="py-6">
				<PageHeader
					align="center"
					icon={HeartHandshake}
					title="🐾 喵の朋友们"
					description="喵世界再大，有缘的小伙伴也能像在身边一样呢"
				/>

				<MotionHighlight hover className="rounded-2xl">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{linksList.map((item) => (
							<a
								href={item.href}
								key={item.href}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
							>
								<Card className="h-full transition-colors duration-200 hover:bg-muted/40 hover:ring-border">
									<div className="flex gap-4 px-4 py-1">
										<Avatar className="shrink-0 size-10 rounded-xl">
											<AvatarImage src={item.avatar} />
											<AvatarFallback className="text-xs bg-muted rounded-xl">
												{item.title.slice(0, 2)}
											</AvatarFallback>
										</Avatar>
										<div className="flex flex-col flex-1 gap-1 min-w-0">
											<span className="text-sm font-medium">{item.title}</span>
											{item.description && (
												<span className="text-xs leading-relaxed line-clamp-2 text-muted-foreground">
													{item.description}
												</span>
											)}
										</div>
									</div>
								</Card>
							</a>
						))}
					</div>
				</MotionHighlight>
			</section>
		</MotionConfig>
	);
}
