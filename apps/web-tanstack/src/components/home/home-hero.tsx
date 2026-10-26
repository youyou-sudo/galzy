import { Badge } from "@web/components/ui/badge";
import { Image } from "@unpic/react";
import { ExternalLink } from "lucide-react";

/**
 * 首页首屏标题区：品牌标识 + 主标题 + 一句话说明 + 防失联 Badge。
 *
 * 抽成独立组件是为了让真实首页与 pending 态共用同一份外壳 HTML：
 * 这些文案不依赖任何请求，pending 期间也应直接渲染真实内容，不能出骨架。
 * 视觉与顶栏同源：圆角图标底片 + 发丝边 + 克制的灰。
 */
export function HomeHero() {
	return (
		<section className="mt-6 flex flex-col items-center gap-3 text-center sm:mt-10">
			<div className="flex items-center gap-3">
				<span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/5 ring-1 ring-border/60">
					<Image
						src="/favicon.ico"
						width={32}
						height={32}
						fetchPriority="low"
						decoding="async"
						className="size-8"
					/>
				</span>
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
					紫缘社
				</h1>
			</div>
			<p className="max-w-md text-sm leading-relaxed text-muted-foreground">
				Galgame 资源站 · 收录汉化作品、攻略与玩家讨论
			</p>
			<Badge
				variant="outline"
				className="h-6 bg-background/60 px-3"
				render={
					<a href="https://galzy.top/" target="_blank" rel="noreferrer" />
				}
			>
				<ExternalLink data-icon="inline-start" />
				防失联地址：galzy.top
			</Badge>
		</section>
	);
}
