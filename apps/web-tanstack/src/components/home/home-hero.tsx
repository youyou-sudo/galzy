import { Badge } from "@web/components/ui/badge";
import { ExternalLink } from "lucide-react";

/**
 * 首页首屏标题区：主标题 + 防失联 Badge。
 *
 * 抽成独立组件是为了让真实首页与 pending 态共用同一份外壳 HTML：
 * 这两行文案不依赖任何请求，pending 期间也应直接渲染真实内容，不能出骨架。
 */
export function HomeHero() {
	return (
		<>
			<h1 className="text-4xl font-semibold text-center mt-6">紫缘社</h1>
			<div className="flex justify-center mt-2">
				<Badge
					variant="outline"
					render={
						<a href="https://galzy.top/" target="_blank" rel="noreferrer" />
					}
				>
					<ExternalLink data-icon="inline-start" />
					防失联地址：galzy.top
				</Badge>
			</div>
		</>
	);
}
