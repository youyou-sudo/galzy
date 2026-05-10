import { api } from "@libs";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Gamepad2, Tags } from "lucide-react";
import z from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";

import { RankingList } from "#/components/home/remf";
import { assertOk } from "#/lib/assertOk";
import CountComponent from "#/components/home/Count";
import SearchInput from "#/components/home/search/Search";
import HomeGamelist from "#/components/home/homeGameList";

export const getGameList = createServerFn()
  .inputValidator(
    z
      .object({
        pageSize: z.number(),
        pageIndex: z.number(),
      })
      .partial()
      .default({}),
  )
  .handler(async ({ data }) => {
    const gamelistRes = await api.games.gamelist.get({
      query: { pageIndex: data.pageIndex || 0, pageSize: data.pageSize || 24 },
    });
    return { gamelist: assertOk(gamelistRes, "homeGameList") };
  });

const getCritical = createServerFn().handler(async () => {
  const [gameRes, tagRes] = await Promise.all([
    api.umami.remfGame.get(),
    api.umami.remfTag.get(),
  ]);

  return {
    game: assertOk(gameRes, "game"),
    tag: assertOk(tagRes, "tag"),
  };
});

export const Route = createFileRoute("/")({
  component: App,
  loader: async () => ({
    gamelist: await getGameList(),
    rankings: getCritical(),
  }),
  // CDN caching (via headers)
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }),
  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
});

function App() {
  return (
    <>
      <h1 className="text-4xl font-semibold text-center mt-10">紫缘社</h1>

      <CountComponent />

      <HanderComp />

      <HomeGamelist />
    </>
  );
}

const HanderComp = () => {
  return (
    <>
      {/* 搜索框 */}
      <div className="px-5 sm:px-20 lg:px-80 my-4">
        <SearchInput />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-2 px-0 md:px-3 mb-0">
        <section>
          <Card className="gap-3 border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                热门标签 <Tags className="size-4 ml-1 text-red-300" />
              </CardTitle>
              <CardDescription>每周检索最多标签</CardDescription>
            </CardHeader>
            <CardContent>
              <RankingList linkKey="tag" />
            </CardContent>
          </Card>
        </section>
        <section>
          <Card className="gap-3 border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                热门游戏 <Gamepad2 className="size-4 ml-1 text-red-300" />
              </CardTitle>
              <CardDescription>每周浏览最多游戏</CardDescription>
            </CardHeader>
            <CardContent>
              <RankingList linkKey="id" />
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
};
