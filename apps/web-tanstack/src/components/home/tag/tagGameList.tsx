import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { getImageUrl } from "#/lib/ImageUrl";
import { getVnListByTag } from "#/routes/tags/$tagId";
import { Button } from "../../ui/button";
import { GameCard } from "../card";
import { GameItem } from "../GameItem";

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
				data: { tagId, pageIndex: pageParam, pageSize: 24 },
			});
			if (!items) {
				return null;
			}
			return items;
		},
		initialPageParam: 1,
		initialData: {
			pages: [game],
			pageParams: [0],
		},
		getNextPageParam: (lastPage) =>
			lastPage && lastPage.currentPage < lastPage.totalPages
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
					<GameItem
						key={item.id}
						gameid={String(item.id)}
						width={item.images?.width ?? 200}
						height={item.images?.height ?? 300}
						src={getImageUrl({
							imageId: item.images?.id,
							width: item.images?.width,
							height: item.images?.height,
						})}
						title={
							item.titles?.find(
								(t) => t.lang === item.olang && t.title.trim() !== "",
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
			<div className="grid grid-cols-3 gap-4 md:grid-cols-6 p-3">
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
