'use client'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import { getCmments } from '@web/server/comments'
import { replycardActions } from '@web/stores/reply-edit-input'
import {
  MessageCircleQuestionMark,
  MessageSquareHeart,
  ShieldQuestionMark,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { ReplyEidtInput } from './reply-edit-input'

function formatTime(dateStr: string) {
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

const typeLabelMap: Record<
  string,
  { label: string; className: string; icon: typeof ShieldQuestionMark }
> = {
  comment: {
    label: '讨论',
    className: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    icon: MessageSquareHeart,
  },
  feedback: {
    label: '反馈',
    className:
      'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    icon: MessageCircleQuestionMark,
  },
  question: {
    label: '提问',
    className:
      'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
    icon: ShieldQuestionMark,
  },
}

const Route = getRouteApi('/$id/_layout/comment')

function ReplyItem({
  commentId,
  targetType,
}: {
  commentId: string
  targetType: string
}) {
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
  })

  const comment = data?.comments?.find((c) => c.id === commentId)
  const replies = comment?.re.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  if (!comment) return null
  if (replies?.length === 0) return <Separator />

  return replies?.map((reply) => (
    <div className="flex -ml-6" key={reply.id}>
      <Separator orientation="vertical" />
      <div className="flex space-x-3 pl-3 py-2 w-full">
        <Avatar className="size-8">
          <AvatarImage src={reply.user?.image || ''} alt={reply.user?.name} />
          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
            {reply.user?.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {reply.user?.name}
            </span>
          </div>
          <p className="text-sm text-foreground/80 mt-0.5">
            {reply.reUser && (
              <span className="text-primary">回复@{reply.reUser.name}：</span>
            )}
            {reply.content}
          </p>

          <div className="flex items-center">
            <span className="text-xs text-muted-foreground">
              {formatTime(reply.createdAt.toString())}
            </span>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                replycardActions.openReId(reply.id, {
                  id: reply.id,
                  userId: reply.user?.id,
                  userName: reply.user?.name,
                })
              }}
            >
              回复
            </Button>
          </div>

          <ReplyEidtInput
            reId={reply.id}
            targetId={id}
            commentscomp={false}
            targetType="game"
          />
          <ReplyItem targetType="game" commentId={reply.id} />
        </div>
      </div>
    </div>
  ))
}
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
  })
  const { data: session } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })

  if (data?.comments.length === 0)
    return (
      <div className="text-center mt-5 items-center">此条目没有评论喵～</div>
    )

  return data?.comments?.map((items) => {
    const IconComponent = typeLabelMap[items.type]?.icon
    return (
      <div key={items.id}>
        <div className="flex space-x-2 mt-2">
          <Avatar className="size-8">
            <AvatarImage src={items.user?.image || ''} alt={items.user?.name} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {items.user?.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <span className="text-sm font-medium text-foreground">
                {items.user?.name}
              </span>
              <Badge
                variant="secondary"
                className={`text-xs ${typeLabelMap[items.type]?.className} -mb-0.5`}
              >
                {IconComponent && <IconComponent data-icon="inline-start" />}
                {typeLabelMap[items.type]?.label}
              </Badge>
            </div>
            <p className="text-sm text-foreground/80 mt-0.5 wrap-break-word whitespace-pre-wrap">
              {items.content}
            </p>
            <div className="flex items-center text-xs -mt-1">
              <span className="text-muted-foreground my-2">
                {formatTime(items.createdAt.toISOString())}
              </span>
              {session && (
                <Button
                  variant="ghost"
                  className="text-muted-foreground text-xs"
                  onClick={() => {
                    replycardActions.openReId(items.id, {
                      id: items.id,
                      userId: items.user?.id,
                      userName: items.user?.name,
                    })
                  }}
                >
                  回复
                </Button>
              )}
            </div>

            <ReplyEidtInput
              reId={items.id}
              targetId={id}
              commentscomp={false}
              targetType="game"
            />
            {items.re?.length > 0 && (
              <ReplyItem targetType="game" commentId={items.id} />
            )}
          </div>
        </div>

        {items.re?.length === 0 && <Separator />}
      </div>
    )
  })
}
