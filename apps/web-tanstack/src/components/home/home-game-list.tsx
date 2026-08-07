import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { getGameList } from "@web/server/game";
import { ListFilter } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { GameCard } from "./card";

const apiroute = getRouteApi("/");

type SortMode = "id" | "released";
type SortOrder = "desc" | "asc";

const HomeGamelist = () => {
	const {
		gamelist: { gamelist },
	} = apiroute.useLoaderData();

	const [sortBy, setSortBy] = useState<SortMode>("id");
	const [order, setOrder] = useState<SortOrder>("desc");

	const {
		data: gameListData,
		isLoading,
		isFetchingNextPage,
		fetchNextPage,
		hasNextPage,
	} = useInfiniteQuery({
		queryKey: ["homeGameList", sortBy, order],
		queryFn: async ({ pageParam }) => {
			const { gamelist } = await getGameList({
				data: {
					pageIndex: pageParam,
					pageSize: 24,
					sortBy,
					order,
				},
			});
			if (!gamelist) {
				return null;
			}
			return gamelist;
		},
		initialPageParam: sortBy === "id" && order === "desc" ? 1 : 0,
		initialData:
			sortBy === "id" && order === "desc"
				? { pages: [gamelist], pageParams: [0] }
				: undefined,
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

	const gameList = gameListData?.pages.flatMap((page) =>
		page?.items?.map((item) => (
			<GameCard.Item
				key={item.id}
				gameid={String(item.id)}
				width={item.images?.width ?? 200}
				height={item.images?.height ?? 300}
				src={item.images?.imageUrl ?? "/No-Image-Placeholder.svg.webp"}
				cSexualAvg={item.images?.c_sexual_avg}
				title={
					item?.titles?.find(
						(t) => t.lang === item.olang && t.title.trim() !== "",
					)?.title || "null"
				}
			/>
		)),
	);

	return (
		<section>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<ListFilter className="size-4 text-muted-foreground" />
					<span className="text-sm text-muted-foreground">排序：</span>
					<Button
						variant={sortBy === "id" ? "default" : "outline"}
						size="sm"
						onClick={() => setSortBy("id")}
					>
						收录时间
					</Button>
					<Button
						variant={sortBy === "released" ? "default" : "outline"}
						size="sm"
						onClick={() => setSortBy("released")}
					>
						发布时间
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setOrder((o) => (o === "desc" ? "asc" : "desc"))}
					>
						{order === "desc" ? "↓ 降序" : "↑ 升序"}
					</Button>
				</div>
				<Link
					to="/games"
					className="text-sm text-muted-foreground hover:text-primary transition-colors"
				>
					更多游戏 →
				</Link>
			</div>
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
		</section>
	);
};

export default HomeGamelist;
