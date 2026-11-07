import { Skeleton } from "@web/components/ui/skeleton";
import { cn } from "@web/lib/utils";

/**
 * 正文骨架：与 RichContent 的 prose 容器同宽的多行灰条。
 *
 * 用在 RichContent html 分支的 Suspense fallback —— tiptap 渲染链（generateJSON
 * + static-renderer + 编辑器扩展）是按需动态 import 的大 chunk（~1MB），冷启动 /
 * 弱网下正文会晚于页面外壳到达；空 div 表现为「先空白再突然出现」，同宽骨架
 * 让正文区域从一开始就有确定高度，模块就绪后原地替换。
 *
 * 行宽写死成固定序列（不用随机值）：每次渲染随机会导致占位宽度抖动。
 */
const ROW_WIDTHS = [
	"w-full",
	"w-[92%]",
	"w-[96%]",
	"w-[88%]",
	"w-3/5",
	"w-[99%]",
	"w-[95%]",
	"w-2/5",
] as const;

export function RichContentSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn("space-y-2.5", className)} aria-hidden>
			{ROW_WIDTHS.map((width) => (
				<Skeleton key={width} className={cn("h-4", width)} />
			))}
		</div>
	);
}
