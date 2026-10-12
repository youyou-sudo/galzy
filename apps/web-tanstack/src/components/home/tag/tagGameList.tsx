import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { Button } from "@web/components/ui/button";
import { getVnListByTag } from "@web/server/tags";
import { GameCard } from "../card";

const apiroute = getRouteApi("/tags/$tagId");

export const TagGamelist = () => {
	const { game, tagId } = apiroute.useLoaderData();
	const {
		data: gameListData,
		isLoading,
		isFetchingNextPage,
		fetchNextPage,
		hasNextPage,
	} = useInfiniteQuery({
		queryKey: ["tagGameList", tagId],
		queryFn: async ({ pageParam }) => {
			const items = await getVnListByTag({
				// 必须与路由 loader 传入的 includeChildren 保持一致，
				// 否则第 1 页按「含子标签」语义、后续页按「仅直接标注」语义，
				// 翻页会出现内容跳变。
				data: {
					tagId,
					pageIndex: pageParam,
					pageSize: 24,
					includeChildren: true,
				},
			});
			if (!items) {
				return null;
			}
			return items;
		},
		initialPageParam: 0,
		initialData: {
			pages: [game],
			pageParams: [0],
		},
		// currentPage 是 0 基页索引（与请求的 pageIndex 一致），totalPages 是 1 基总页数。
		// 还有下一页 ⇔ currentPage + 1 < totalPages：原先的 `currentPage < totalPages`
		// 在「总数不满一页」（totalPages === 1、currentPage === 0）时恒为真，
		// 会错误地渲染出「加载更多」并触发一次返回空列表的多余请求。
		getNextPageParam: (lastPage) =>
			lastPage && lastPage.currentPage + 1 < lastPage.totalPages
				? lastPage.currentPage + 1
				: null,
	});

	const getNextPage = () => {
		if (hasNextPage) {
			fetchNextPage();
		}
	};

	const items = gameListData?.pages.flatMap((page) => page?.items ?? []) ?? [];

	const gameList =
		items.length > 0 ? (
			items.map((item) =>
				item ? (
					<GameCard.Item
						key={item.id}
						gameid={String(item.id)}
						width={item.images?.width ?? 200}
						height={item.images?.height ?? 300}
						thumbhash={item.images?.thumbhash}
						src={item.images?.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
						cSexualAvg={item.images?.c_sexual_avg}
						title={
							item.titles?.find(
								(t) => t.lang === item.olang && (t.title ?? "").trim() !== "",
							)?.title || "null"
						}
					/>
				) : null,
			)
		) : (
			<div className="text-center items-center">没找相关的游戏喵～</div>
		);

	return (
		<>
			<div className="grid grid-cols-3 gap-4 md:grid-cols-6">
				{gameList}
				{isLoading || isFetchingNextPage ? (
					<>
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
						<GameCard.ListSkeleton />
					</>
				) : null}
			</div>
			{hasNextPage && (
				<div className="flex justify-center mt-4">
					<Button size="lg" onClick={getNextPage}>
						加载更多
					</Button>
				</div>
			)}
		</>
	);
};
