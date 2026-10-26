'use client'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { memo, useMemo } from 'react'
import { EmptyState } from '@web/components/shared/empty-state'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import { getCmments } from '@web/server/comments'
import { replycardActions } from '@web/stores/reply-edit-input'
import {
  MessageCircleQuestionMark,
  MessageSquare,
  MessageSquareHeart,
  ShieldQuestionMark,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { ReplyEidtInput } from './reply-edit-input'
import { CommentMarkdown } from './comment-markdown'

/**
 * 评论类型徽标：只用语义色（info / primary / warning）+ 同色淡底，
 * 不再写死 blue/purple/yellow 原始调色板，深浅色主题共用一套。
 */
const typeLabelMap: Record<
  string,
  { label: string; className: string; icon: typeof ShieldQuestionMark }
> = {
  comment: {
    label: '讨论',
    className: 'text-info bg-info/10',
    icon: MessageSquareHeart,
  },
  feedback: {
    label: '反馈',
    className: 'text-primary bg-primary/10',
    icon: MessageCircleQuestionMark,
  },
  question: {
    label: '提问',
    className: 'text-warning bg-warning/10',
    icon: ShieldQuestionMark,
  },
}

// 兼容 string 与 Date 两种形态：API 经 Eden/Elysia 返回的时间戳是 ISO 字符串，
// 而 SSR 序列化（seroval）或某些内部路径可能给到真正的 Date 对象。
function formatTime(dateStr: string | Date) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 30) return `${days} 天前`
  return date.toLocaleDateString('zh-CN')
}

const Route = getRouteApi('/$id/_layout/comment')

type CommentsData = Exclude<Awaited<ReturnType<typeof getCmments>>, null>
type CommentEntry = NonNullable<CommentsData['comments']>[number]

const ReplyItem = memo(function ReplyItem({
  comment,
  commentMap,
  targetId,
  depth = 0,
}: {
  comment: CommentEntry | undefined
  commentMap: Map<string, CommentEntry>
  targetId: string
  depth?: number
}) {
  const replies = useMemo(
    () =>
      [...(comment?.re ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [comment],
  )

  if (!comment) return null
  if (replies.length === 0) return null

  return (
    // 一级回复只缩进 10px；更深层不再继续加缩进（扁平化），靠「回复@xx」保留上下文，
    // 避免 3 层嵌套后正文被挤到半屏宽。
    <div className={depth === 0 ? "pl-2.5 mt-1 border-l border-border/60" : "mt-1"}>
      {replies.map((reply) => (
        <div className="py-1.5 first:pt-0 last:pb-0" key={reply.id}>
          <div className="flex gap-2">
            <Avatar className="size-6">
              <AvatarImage src={reply.user?.image || ''} alt={reply.user?.name} />
              <AvatarFallback className="text-[10px] text-muted-foreground bg-muted">
                {reply.user?.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                <span className="text-[13px] font-medium text-foreground">
                  {reply.user?.name}
                </span>
                {reply.reUser && (
                  <span className="text-xs text-primary">
                    回复 @{reply.reUser.name}
                  </span>
                )}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatTime(reply.createdAt.toString())}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  onClick={() => {
                    replycardActions.openReId(reply.id, {
                      id: reply.id,
                      userId: reply.user?.id,
                      userName: reply.user?.name,
                    })
                  }}
                >
                  回复
                </button>
              </div>

              <div className="mt-0.5 text-sm text-foreground/80">
                <CommentMarkdown content={reply.content} />
              </div>

              <ReplyEidtInput
                reId={reply.id}
                targetId={targetId}
                commentscomp={false}
                targetType="game"
              />
              <ReplyItem
                comment={commentMap.get(reply.id)}
                commentMap={commentMap}
                targetId={targetId}
                depth={depth + 1}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
})

export function CommentItem({ targetType }: { targetType: string }) {
  const { commentsData, id } = Route.useLoaderData()

  const { data } = useQuery({
    queryKey: ['comments', targetType, id],
    queryFn: async () =>
      await getCmments({
        data: {
          targetType: targetType,
          targetId: id,
        },
      }),
    initialData: commentsData,
    // loader 已提供 initialData；不设 staleTime 会在挂载时立即判 stale 重拉一次
    staleTime: 30_000,
  })
  const { data: session } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })

  const commentMap = useMemo(
    () => new Map((data?.comments ?? []).map((c) => [c.id, c] as const)),
    [data?.comments],
  )

  if (data?.comments.length === 0)
    return (
      <EmptyState
        size="sm"
        icon={MessageSquare}
        title="暂无评论"
        description="来写第一条评论吧"
      />
    )

  return (
    <div className="mt-3 divide-y divide-border/60">
      {data?.comments?.map((items) => {
        const typeMeta = typeLabelMap[items.type]
        const IconComponent = typeMeta?.icon
        return (
          <div key={items.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex gap-2.5">
              <Avatar className="size-7">
                <AvatarImage
                  src={items.user?.image || ''}
                  alt={items.user?.name}
                />
                <AvatarFallback className="text-[10px] text-muted-foreground bg-muted">
                  {items.user?.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                  <span className="text-sm font-medium text-foreground">
                    {items.user?.name}
                  </span>
                  {typeMeta && (
                    <Badge
                      variant="secondary"
                      className={`h-[18px] px-1.5 text-[10px] ${typeMeta.className}`}
                    >
                      {IconComponent && (
                        <IconComponent data-icon="inline-start" />
                      )}
                      {typeMeta.label}
                    </Badge>
                  )}
                  <span className="flex shrink-0 gap-2 items-center ml-auto text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {formatTime(items.createdAt)}
                    </span>
                    {session && (
                      <button
                        type="button"
                        className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        onClick={() => {
                          replycardActions.openReId(items.id, {
                            id: items.id,
                            userId: items.user?.id,
                            userName: items.user?.name,
                          })
                        }}
                      >
                        回复
                      </button>
                    )}
                  </span>
                </div>

                <div className="mt-0.5">
                  <CommentMarkdown content={items.content} />
                </div>

                <ReplyEidtInput
                  reId={items.id}
                  targetId={id}
                  commentscomp={false}
                  targetType="game"
                />
                {items.re?.length > 0 && (
                  <ReplyItem
                    comment={commentMap.get(items.id)}
                    commentMap={commentMap}
                    targetId={id}
                    depth={0}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
