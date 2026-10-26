import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@web/components/ui/skeleton";
import { getTotalCount } from "@web/server/game";
import { Send } from "lucide-react";

/**
 * 收录总数条：数字与频道入口并排，作为首屏的「数据背书」。
 * 保留「共收录了：…条目」的文案切分，便于 pending 测试按区间断言。
 */
export default function CountComponent() {
	return (
		<div className="my-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
			<span className="inline-flex items-center gap-1.5 tabular-nums">
				共收录了：<Count /> 条目
			</span>
			<span aria-hidden="true" className="hidden h-3 w-px bg-border sm:block" />
			<a
				className="inline-flex items-center gap-1 font-medium text-primary no-underline transition-colors hover:text-primary/80"
				target="_blank"
				href="https://t.me/ziyuanlinyin"
				rel="noopener"
			>
				频道
				<Send className="size-3.5" />
			</a>
		</div>
	);
}

/**
 * 收录总数。
 *
 * 刻意不用 Suspense / useSuspenseQuery：SSR 期间只要挂起，整页 HTML 都要等这次请求
 * 才能开始发（首字节被一个数字拖住）。这里用普通 useQuery + 数字骨架：服务端先出
 * 「共收录了：…条目」的外壳，数字在客户端补上，文案与布局都不跳。
 */
const Count = () => {
	const { data } = useQuery({
		queryKey: ["totalCount"],
		queryFn: () => getTotalCount(),
	});

	if (data === undefined) {
		return <Skeleton className="mx-0.5 inline-block h-4 w-10 align-middle" />;
	}

	return <>{data}</>;
};
