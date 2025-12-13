import { api } from '@libs'
import ForesightLink from '@web/components/HoverPLink'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { ArrowLeft, User } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next/types'
import React from 'react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

type Props = {
  params: Promise<{ id: string; introduction: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { introduction } = await params
  function stripHTML(html: string) {
    return html.replace(/<[^>]*>/g, '')
  }
  function stripMarkdown(md: string) {
    return md
      .replace(/(\*\*|__)(.*?)\1/g, '$2') // 粗体
      .replace(/(\*|_)(.*?)\1/g, '$2') // 斜体
      .replace(/!\[.*?\]\(.*?\)/g, '') // 图片
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // 链接
      .replace(/[`~>#-]/g, '') // 代码块/引用/列表符号
  }
  const { data: strategyContent } = await api.strategy.strategy.get({
    query: {
      strategyId: +introduction,
    },
  })
  const raw = strategyContent?.content
    ?? strategyContent?.title
    ?? ''

  const textOnly = stripMarkdown(stripHTML(raw!))
  return {
    title: strategyContent?.title,
    description: textOnly.slice(0, 200),
  }
}

export default async function page({ params }: Props) {
  // [x] 攻略文章阅读
  const { introduction } = await params
  const { data: strategyContent } = await api.strategy.strategy.get({
    query: {
      strategyId: +introduction,
    },
  })
  return (
    <>
      <ForesightLink
        href={`./introduction`}
        className="flex items-center pt-3 pl-3 gap-1 underline opacity-50 hover:opacity-100"
      >
        <ArrowLeft className="w-4 h-4" />
        返回
      </ForesightLink>
      <article>
        <Card className="border-0 pt-0">
          <CardHeader>
            <CardTitle className="text-2xl items-center text-center">
              {strategyContent?.title}
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
                <span>
                  {strategyContent?.createdAt.toISOString().split('T')[0]}
                </span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Markdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>
                {strategyContent?.content}
              </Markdown>
            </div>
            <div className="text-right">
              {strategyContent?.copyright && (
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
                      '',
                    )}
                  </Link>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </article>
    </>
  )
}
