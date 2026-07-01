import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '@web/components/ui/badge'
import { Button } from '@web/components/ui/button'
import { Card, CardContent, CardHeader } from '@web/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog'
import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select'
import { Textarea } from '@web/components/ui/textarea'
import {
  adminChangeCommentStatus,
  adminDeleteComment,
  adminGetComments,
  adminTogglePin,
  adminUpdateComment,
} from '@web/server/admin/comments'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  MessageSquareIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/_authL/comments')({
  component: RouteComponent,
})

interface CommentUser {
  id: string
  name: string
  email: string
  image?: string | null
}

interface ReplyItem {
  id: string
  content: string
  createdAt: Date
  user?: CommentUser | null
  reUser?: CommentUser | null
}

interface Comment {
  id: string
  targetType: string
  targetId: string
  userId: string
  content: string
  type: string
  status: string
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
  user?: CommentUser | null
  re?: ReplyItem[]
}

const PAGE_SIZE = 15

function RouteComponent() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">评论管理</h1>
          <p className="text-muted-foreground mt-1">
            管理全站评论，支持编辑、删除、状态变更与置顶操作
          </p>
        </div>
      </div>

      <CommentsTable />
    </div>
  )
}

function CommentsTable() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'admin-comments',
      {
        searchValue: search,
        status: statusFilter,
        type: typeFilter,
        offset,
        limit: PAGE_SIZE,
      },
    ],
    queryFn: async () => {
      const res = await adminGetComments({
        data: {
          page: Math.floor(offset / PAGE_SIZE) + 1,
          limit: PAGE_SIZE,
          targetId: search || undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
        },
      })
      return res as unknown as {
        comments: Comment[]
        total: number
        totalPages: number
      }
    },
  })

  if (error) {
    toast.error(error instanceof Error ? error.message : '获取评论列表出错')
  }

  const comments = data?.comments ?? []
  const total = data?.total ?? 0

  const handleSearch = () => {
    setOffset(0)
    setSearch(searchInput)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  const goNext = () => {
    if (currentPage < totalPages) {
      setOffset(offset + PAGE_SIZE)
    }
  }

  const goPrev = () => {
    if (currentPage > 1) {
      setOffset(Math.max(0, offset - PAGE_SIZE))
    }
  }

  const refresh = () => refetch()

  const statusLabel: Record<
    string,
    {
      label: string
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
    }
  > = {
    normal: { label: '正常', variant: 'outline' as const },
    hidden: { label: '隐藏', variant: 'secondary' as const },
    deleted: { label: '已删除', variant: 'destructive' as const },
  }

  const typeLabel: Record<string, string> = {
    comment: '讨论',
    feedback: '反馈',
    question: '提问',
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索目标 ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v === '__all__' ? '' : v)
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部状态</SelectItem>
              <SelectItem value="normal">正常</SelectItem>
              <SelectItem value="hidden">隐藏</SelectItem>
              <SelectItem value="deleted">已删除</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => {
              setTypeFilter(v === '__all__' ? '' : v)
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部类型</SelectItem>
              <SelectItem value="comment">讨论</SelectItem>
              <SelectItem value="feedback">反馈</SelectItem>
              <SelectItem value="question">提问</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSearch} disabled={isLoading}>
            搜索
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquareIcon className="size-10 mb-2" />
            <p className="text-sm">暂无评论数据</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    用户
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    内容
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    目标
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    类型
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    状态
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    时间
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {comments.map((comment) => {
                  const sl = statusLabel[comment.status] ?? {
                    label: comment.status,
                    variant: 'secondary' as const,
                  }
                  return (
                    <tr
                      key={comment.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.user?.name || '未知'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-sm text-muted-foreground truncate">
                          {comment.content}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {comment.targetType}/{comment.targetId?.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabel[comment.type] || comment.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sl.variant}>{sl.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(comment.createdAt).toLocaleDateString(
                          'zh-CN',
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <EditCommentDialog
                            comment={comment}
                            onDone={refresh}
                          />
                          <TogglePinButton comment={comment} onDone={refresh} />
                          {comment.status !== 'hidden' && (
                            <HideCommentButton
                              comment={comment}
                              onDone={refresh}
                            />
                          )}
                          {comment.status === 'hidden' && (
                            <UnhideCommentButton
                              comment={comment}
                              onDone={refresh}
                            />
                          )}
                          <DeleteCommentDialog
                            comment={comment}
                            onDone={refresh}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <span className="text-xs text-muted-foreground">
            共 {total} 条评论 · 第 {currentPage}/{totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={currentPage <= 1}
            >
              <ChevronLeftIcon className="size-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={currentPage >= totalPages}
            >
              下一页
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function EditCommentDialog({
  comment,
  onDone,
}: {
  comment: Comment
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(comment.content)
  const [submitting, setSubmitting] = useState(false)

  const handleEdit = async () => {
    if (!content.trim()) {
      toast.error('内容不能为空')
      return
    }

    setSubmitting(true)
    try {
      const res = await adminUpdateComment({
        data: { id: comment.id, content },
      })
      if (!res) {
        toast.error('编辑评论失败')
        return
      }
      toast.success('评论已更新')
      setOpen(false)
      onDone()
    } catch {
      toast.error('编辑评论出错')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setContent(comment.content)
      }}
    >
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <PencilIcon className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑评论</DialogTitle>
          <DialogDescription>修改评论内容</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-content">内容</Label>
            <Textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleEdit} disabled={submitting}>
            {submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TogglePinButton({
  comment,
  onDone,
}: {
  comment: Comment
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      const res = await adminTogglePin({ data: { id: comment.id } })
      if (!res) {
        toast.error('操作失败')
        return
      }
      toast.success(comment.isPinned ? '已取消置顶' : '已置顶')
      onDone()
    } catch {
      toast.error('操作出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleToggle} disabled={loading}>
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : comment.isPinned ? (
        <PinOffIcon className="size-4 text-orange-500" />
      ) : (
        <PinIcon className="size-4 text-muted-foreground" />
      )}
    </Button>
  )
}

function HideCommentButton({
  comment,
  onDone,
}: {
  comment: Comment
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleHide = async () => {
    setLoading(true)
    try {
      const res = await adminChangeCommentStatus({
        data: { id: comment.id, status: 'hidden' },
      })
      if (!res) {
        toast.error('操作失败')
        return
      }
      toast.success('评论已隐藏')
      onDone()
    } catch {
      toast.error('操作出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleHide} disabled={loading}>
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <span className="text-xs text-muted-foreground">隐藏</span>
      )}
    </Button>
  )
}

function UnhideCommentButton({
  comment,
  onDone,
}: {
  comment: Comment
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleUnhide = async () => {
    setLoading(true)
    try {
      const res = await adminChangeCommentStatus({
        data: { id: comment.id, status: 'normal' },
      })
      if (!res) {
        toast.error('操作失败')
        return
      }
      toast.success('评论已恢复')
      onDone()
    } catch {
      toast.error('操作出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleUnhide} disabled={loading}>
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <span className="text-xs text-green-600">恢复</span>
      )}
    </Button>
  )
}

function DeleteCommentDialog({
  comment,
  onDone,
}: {
  comment: Comment
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleDelete = async () => {
    setSubmitting(true)
    try {
      const res = await adminDeleteComment({ data: { id: comment.id } })
      if (!res) {
        toast.error('删除评论失败')
        return
      }
      toast.success('评论已删除')
      setOpen(false)
      onDone()
    } catch {
      toast.error('删除评论出错')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2Icon className="size-4 text-destructive" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除评论</DialogTitle>
          <DialogDescription>
            此操作将软删除该评论，将其状态标记为"已删除"。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">确定要删除此评论吗？</p>
          <blockquote className="text-sm border-l-2 pl-3 text-muted-foreground italic">
            {comment.content.slice(0, 100)}
          </blockquote>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
