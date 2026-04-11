import { api } from "@libs";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, Swords, TrendingUp } from "lucide-react";
import { useState } from "react";
import z from "zod";
import { BBCodeRenderer } from "#/components/bbcode";
import { Glgczujm } from "#/components/game/tips";
import { GameCard } from "#/components/home/card";
import { TagsCard } from "#/components/home/game/tags";
import { Card, CardContent } from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { seoTemplate } from "#/config/seoTemplate";
import { assertOk } from "#/lib/assertOk";
import { getImageUrl } from "#/lib/ImageUrl";

export const getGameDetail = createServerFn()
	.inputValidator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const getgame = await api.games.get({
			query: {
				id: data.id,
			},
		});
		return assertOk(getgame, "game");
	});

const getGameTags = createServerFn()
	.inputValidator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const res = await api.tags.gametags.post({ id: data.id });
		return assertOk(res, "tags");
	});

export const Route = createFileRoute("/$id/_layout")({
	component: RouteComponent,
	loader: async ({ params }) => {
		const { id } = params;
		return {
			game: await getGameDetail({ data: { id } }),
			tags: getGameTags({ data: { id } }),
			id,
		};
	},
	staleTime: 1000 * 30,
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${
					loaderData?.game?.vn_datas?.titles?.find(
						(t) =>
							t.lang === loaderData?.game?.vn_datas?.olang &&
							t.title.trim() !== "",
					)?.title || "Galgame"
				} 下载 | ${seoTemplate.title}`,
			},
			{
				name: "description",
				content: `${
					loaderData?.game?.vn_datas?.titles?.find(
						(t) =>
							t.lang === loaderData?.game?.vn_datas?.olang &&
							t.title.trim() !== "",
					)?.title || "Gamgame"
				} 资源下载，游戏别名：${loaderData?.game?.vn_datas?.alias || "无"}，简介：${loaderData?.game?.vn_datas?.description || "暂无简介"}`,
			},
		],
	}),
});

function RouteComponent() {
	const { game, id } = Route.useLoaderData();
	const [currentTab, setCurrentTab] = useState("download");
	return (
		<div className="space-y-3">
			<Card className="overflow-hidden wrap-break-word border-0 pb-0 ">
				<CardContent>
					{/* Cover and basic info section */}
					<div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 relative">
						<div className="relative inline-block">
							<div
								className={`${
									game?.vn_datas?.images?.height &&
									game?.vn_datas?.images?.height < game?.vn_datas?.images?.width
										? "min-w-72.5"
										: "max-w-55"
								} relative overflow-hidden text-left`}
							>
								<Skeleton className="absolute inset-0 w-full h-full rounded-lg" />
								<GameCard.Image
									width={game?.vn_datas?.images?.width ?? 200}
									height={game?.vn_datas?.images?.height ?? 300}
									loading="lazy"
									decoding="async"
									src={getImageUrl({
										imageId: game?.vn_datas?.images?.id,
										width: game?.vn_datas?.images?.width,
										height: game?.vn_datas?.images?.height,
									})}
									alt={
										game?.vn_datas?.titles?.find(
											(t) =>
												t.lang === game.vn_datas?.olang &&
												t.title.trim() !== "",
										)?.title || "null"
									}
									className="rounded-lg inset-0 w-full h-full object-cover relative"
								/>
							</div>
						</div>
					</div>

					{/* Main content section */}
					<div className="overflow-hidden wrap-break-word">
						<h1 className="font-bold text-2xl leading-[1.2] mt-2">
							{game?.vn_datas?.titles?.find(
								(t) => t.lang === game.vn_datas?.olang && t.title.trim() !== "",
							)?.title || "null"}
						</h1>

						{/* Aliases */}
						{game?.vn_datas?.alias && (
							<div className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-[1.2]">
								别名:{" "}
								{game?.vn_datas?.alias
									.split("\n")
									.map((s) => s.trim())
									.filter(Boolean)
									.filter(
										(s) =>
											s !==
											game?.vn_datas?.titles?.find((t) => t.lang === "zh-Hans")
												?.title,
									)
									.join(", ")}
							</div>
						)}

						{/* Description */}
						{(game?.other_datas?.description ||
							game?.vn_datas?.description) && (
							<div className="mt-4">
								<div className="text-xs text-gray-500 uppercase mb-1">
									游戏简介
								</div>
								<div className="text-sm line-clamp-6  leading-relaxed text-gray-800 dark:text-gray-200">
									<BBCodeRenderer
										text={
											game?.other_datas?.description ||
											game?.vn_datas?.description ||
											""
										}
									/>
								</div>
							</div>
						)}
						{/* Tags section */}
						<TagsCard />
					</div>
				</CardContent>
			</Card>

			<Tabs value={currentTab}>
				<TabsList>
					<TabsTrigger value="download" asChild>
						<Link
							to="/$id"
							params={{ id: id }}
							resetScroll={false}
							activeProps={() => {
								setCurrentTab("download");
								return {};
							}}
						>
							<ArrowDownToLine className="h-4 w-4" />
							下载
						</Link>
					</TabsTrigger>
					<TabsTrigger value="introduction" asChild>
						<Link
							to="/$id/introduction"
							params={{ id: id }}
							resetScroll={false}
							activeProps={() => {
								setCurrentTab("introduction");
								return {};
							}}
						>
							<Swords />
							攻略
						</Link>
					</TabsTrigger>
					<TabsTrigger value="translate" asChild>
						<Link
							to="/$id/translate"
							params={{ id: id }}
							resetScroll={false}
							activeProps={() => {
								setCurrentTab("translate");
								return {};
							}}
						>
							<TrendingUp />
							统计
						</Link>
					</TabsTrigger>
				</TabsList>
			</Tabs>
			<Card className="p-1">
				<CardContent className="p-1">
					<Outlet />
					<Glgczujm />
				</CardContent>
			</Card>
		</div>
	);
}
