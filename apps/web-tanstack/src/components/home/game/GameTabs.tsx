import { Link, useRouterState } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@web/components/ui/tabs'
import {
  ArrowDownToLine,
  MessageCircle,
  Swords,
  TrendingUp,
} from 'lucide-react'

export function GameTabs({ id }: { id: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // segment after /<id>/ determines the tab; introduction handles nested /$articleId
  const segments = pathname.split('/').filter(Boolean)
  const currentTab =
    segments[1] === 'introduction' ||
    segments[1] === 'comment' ||
    segments[1] === 'translate'
      ? segments[1]
      : 'download'

  return (
    <Tabs value={currentTab}>
      <TabsList>
        <TabsTrigger value="download" asChild>
          <Link
            to="/$id"
            params={{ id: id }}
            resetScroll={false}
          >
            <ArrowDownToLine className="size-4" />
            下载
          </Link>
        </TabsTrigger>
        <TabsTrigger value="introduction" asChild>
          <Link
            to="/$id/introduction"
            params={{ id: id }}
            resetScroll={false}
          >
            <Swords />
            攻略
          </Link>
        </TabsTrigger>
        <TabsTrigger value="comment" asChild>
          <Link
            to="/$id/comment"
            params={{ id: id }}
            resetScroll={false}
          >
            <MessageCircle />
            讨论
          </Link>
        </TabsTrigger>
        <TabsTrigger value="translate" asChild>
          <Link
            to="/$id/translate"
            params={{ id: id }}
            resetScroll={false}
          >
            <TrendingUp />
            统计
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
