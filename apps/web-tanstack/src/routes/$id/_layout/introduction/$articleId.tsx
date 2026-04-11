import { api } from "@libs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft, User } from "lucide-react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { seoTemplate } from "#/config/seoTemplate";
import { assertOk } from "#/lib/assertOk";

const getIntroductionArticle = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const res = await api.strategy.strategy.get({
      query: {
        strategyId: +data.id,
      },
    });
    return assertOk(res, "文章");
  });

export const Route = createFileRoute("/$id/_layout/introduction/$articleId")({
  component: RouteComponent,
  loader: async ({ params }) => {
    return getIntroductionArticle({
      data: { id: params.articleId },
    });
  },
  staleTime: 1000 * 30,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title} | ${seoTemplate.title}` },
      {
        name: "description",
        content: `${loaderData?.title}`,
      },
    ],
  }),
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    "Cache-Control":
      "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
  }),
});

function RouteComponent() {
  const content = Route.useLoaderData();
  return (
    <section>
      <Card>
        <CardHeader>
          <Link
            to=".."
            resetScroll={false}
            className="flex items-center pl-3 gap-1 underline opacity-50 hover:opacity-100"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </Link>
          <CardTitle className="text-2xl items-center text-center">
            {content?.title}
          </CardTitle>
          <CardDescription>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1">
                <User className="w-4 h-4" />
                喵喵喵？
              </span>
              <span>|</span>
              <span># 攻略</span>
              <span>|</span>
              <span>{content?.createdAt.toISOString().split("T")[0]}</span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Markdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
              {content?.content}
            </Markdown>
          </div>
          <div className="text-right">
            {content?.copyright && (
              <p className="text-sm items-center">
                来源：
                <a
                  href={content.copyright}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {new URL(content.copyright).hostname.replace(/\.\w+$/, "")}
                </a>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
