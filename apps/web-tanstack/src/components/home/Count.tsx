import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@web/components/ui/skeleton";
import { getTotalCount } from "@web/server/game";
import { Send } from "lucide-react";

export default function CountComponent() {
	return (
		<div className="flex items-center justify-center text-center my-2">
			<span className="pl-1 flex opacity-50">
				共收录了：
				<Count />
				条目
			</span>
			<span className="inline-flex items-center gap-1 ml-2">
				<a
					className="underline text-blue-500 hover:text-blue-300"
					target="_blank"
					href="https://t.me/ziyuanlinyin"
					rel="noopener"
				>
					频道
				</a>
				<Send size={15} className="text-blue-400" />
			</span>
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
		return <Skeleton className="w-10 h-6 justify-center" />;
	}

	return <>{data}</>;
};
