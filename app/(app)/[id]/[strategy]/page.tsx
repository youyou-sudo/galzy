import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/kysely";
import { User } from "lucide-react";
import React from "react";
import remarkGfm from "remark-gfm";
import rehypeParse from "rehype-parse";
import Link from "next/link";
import dynamic from "next/dynamic";

export default async function page({
  params,
}: {
  params: { id: string; strategy: string };
}) {
  // [ ] 攻略文章阅读
  const { strategy } = await params;
  const strategyContent = await db
    .selectFrom("galrc_article")
    .selectAll()
    .where("id", "=", Number(strategy))
    .executeTakeFirstOrThrow();
  const Markdown = dynamic(() => import("react-markdown"));
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl items-center text-center">
            {strategyContent.title}
          </CardTitle>
          <CardDescription>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1">
                <User className="w-4 h-4" /> 2DFan
              </span>
              <span>|</span>
              <span># 攻略</span>
              <span>|</span>
              <span>
                {strategyContent.createdAt.toISOString().split("T")[0]}
              </span>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Markdown remarkPlugins={[rehypeParse, remarkGfm]}>
            {strategyContent.content}
          </Markdown>
          <div className="text-right">
            {strategyContent.copyright && (
              <p className="text-sm items-center">
                来源：
                <Link
                  href={strategyContent.copyright}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {new URL(strategyContent.copyright).hostname.replace(
                    /\.\w+$/,
                    ""
                  )}
                </Link>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
