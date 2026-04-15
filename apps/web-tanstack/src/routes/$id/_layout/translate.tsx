import { api } from "@libs";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { ChartAreaLinear } from "#/components/game/translate/chart-area-linear";
import { seoTemplate } from "#/config/seoTemplate";
import { assertOk } from "#/lib/assertOk";
import { getGameDetail } from "../_layout";

const translateData = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const translate = await api.games.gameTimeNumberGet.get({
      query: { id: data.id, time: "week" },
    });
    return assertOk(translate, "translateData");
  });

export const Route = createFileRoute("/$id/_layout/translate")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { id } = params;
    return {
      translateData: await translateData({ data: { id } }),
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
          } 下载统计 | ${seoTemplate.title}`,
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
  return <ChartAreaLinear />;
}
