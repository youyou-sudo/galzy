import { api } from "@libs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { NotepadText } from "lucide-react";
import z from "zod";
import { seoTemplate } from "#/config/seoTemplate";
import { assertOk } from "#/lib/assertOk";
import { getGameDetail } from "../../_layout";

const getintroductionList = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const res = await api.strategy.gamestrategys.get({
      query: { gameId: data.id },
    });
    return assertOk(res, "攻略列表");
  });

export const Route = createFileRoute("/$id/_layout/introduction/")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { id } = params;
    // 这里可以根据 id 获取相关数据，例如游戏介绍等
    // 例如：
    const introductionList = await getintroductionList({ data: { id } });

    return {
      introductionList,
      id,
      game: await getGameDetail({ data: { id } }),
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.game?.vn_datas?.titles?.find(
          (t) =>
            t.lang === loaderData?.game?.vn_datas?.olang &&
            t.title.trim() !== "",
        )?.title || "Galgame"
          } 攻略文章列表 | ${seoTemplate.title}`,
      },
    ],
  }),
  // CDN caching (via headers)
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }),
  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
});

function RouteComponent() {
  const { introductionList, id } = Route.useLoaderData();
  return (
    <section>
      {!introductionList && <div className="text-center">暂无攻略文章喵～</div>}
      {introductionList && (
        <div className="rounded-lg">
          {introductionList.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-2 space-x-2 rounded-lg"
            >
              <Link
                to="/$id/introduction/$articleId"
                params={{ id: id, articleId: String(item.id) }}
                resetScroll={false}
                className="w-full"
              >
                <div className="pt-2 flex items-center pb-2 w-full">
                  <NotepadText className="w-4 h-4 mr-1" />
                  <span>{item.title}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
