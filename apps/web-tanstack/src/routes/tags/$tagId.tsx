import { api } from "@libs";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import z from "zod";
import { TagGamelist } from "#/components/home/tag/tagGameList";
import { Card, CardHeader, CardTitle } from "#/components/ui/card";
import { seoTemplate } from "#/config/seoTemplate";
import { assertOk } from "#/lib/assertOk";

const getTagData = createServerFn()
  .inputValidator(
    z.object({
      tagId: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const res = await api.tags.tag.get({ query: { tagId: data.tagId } });
    return assertOk(res, `${data.tagId} Tag 信息`);
  });

export const getVnListByTag = createServerFn()
  .inputValidator(
    z.object({
      tagId: z.string(),
      pageSize: z.number(),
      pageIndex: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const res = await api.tags.taggames.post({
      tagId: data.tagId,
      pageSize: data.pageSize,
      pageIndex: data.pageIndex,
    });
    return assertOk(res, `${data.tagId} Tag 关联游戏`);
  });

export const Route = createFileRoute("/tags/$tagId")({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { tagId } = params;
    return {
      tag: await getTagData({ data: { tagId } }),
      game: await getVnListByTag({
        data: { tagId, pageIndex: 0, pageSize: 24 },
      }),
      tagId,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.tag?.zht_name || loaderData?.tag?.name || "标签"} | ${seoTemplate.title}`,
      },
      {
        name: "description",
        content: `${loaderData?.tag?.zht_name || loaderData?.tag?.name || "标签"
          } 类型下的游戏列表，类型介绍：${loaderData?.tag?.zht_description ||
          loaderData?.tag?.description ||
          "无"
          }`,
      },
    ],
  }),
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
});

function RouteComponent() {
  const { tag } = Route.useLoaderData();
  return (
    <>
      <section className="space-y-3 w-full">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl text-center items-center">
              {tag?.zht_name || tag?.name}
            </CardTitle>
            {/* <CardContent className="p-0">
              <BBCodeRenderer
              text={tag?.zht_description || tag?.description || ''}
              />
              </CardContent> */}
          </CardHeader>
        </Card>
      </section>
      <div className="text-sm text-center items-center opacity-30 italic">
        数据过滤，来自 VNDB
      </div>
      <section>
        <TagGamelist />
      </section>
    </>
  );
}
