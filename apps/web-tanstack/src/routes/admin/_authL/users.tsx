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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@web/components/ui/tooltip'
import { authClient } from '@web/server/auth/auth-client'
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CopyIcon,
  Loader2Icon,
  LockIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/_authL/users')({
  component: RouteComponent,
})

// --- Types ---

interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  role?: string
  banned?: boolean
  banReason?: string | null
  banExpires?: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ListUsersResponse {
  users: User[]
  total: number
  limit?: number
  offset?: number
}

// --- Constants ---

const PAGE_SIZE = 15

// --- Main Component ---

function RouteComponent() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground mt-1">
            管理用户账号、角色、封禁与权限
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <UsersTable />
    </div>
  )
}

// --- Users Table ---

function UsersTable() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'admin-users',
      { searchValue: search, offset, limit: PAGE_SIZE },
    ],
    queryFn: async () => {
      const res = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset,
          searchValue: search || undefined,
          searchField: 'email',
          searchOperator: 'contains',
          sortBy: 'createdAt',
          sortDirection: 'desc',
        },
      })

      if (res.error) {
        throw new Error(res.error.message || '获取用户列表失败')
      }

      return res.data as unknown as ListUsersResponse
    },
  })

  useEffect(() => {
    if (error) {
      toast.error(error instanceof Error ? error.message : '获取用户列表出错')
    }
  }, [error])

  const users = data?.users ?? []
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户邮箱..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
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
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <UserIcon className="size-10 mb-2" />
            <p className="text-sm">暂无用户数据</p>
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
                    邮箱
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    角色
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                    状态
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt=""
                            className="size-7 rounded-full"
                          />
                        ) : (
                          <div className="size-7 rounded-full bg-muted flex items-center justify-center">
                            <UserIcon className="size-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          {user.name || '未命名'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <span className="text-sm text-muted-foreground break-all cursor-default">
                            {user.email}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{user.email}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          user.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {user.role || 'user'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.banned ? (
                        <Badge variant="destructive">已封禁</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-600/30"
                        >
                          正常
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <SetRoleDialog user={user} onDone={refresh} />
                        <SetPasswordDialog user={user} onDone={refresh} />
                        {user.banned ? (
                          <UnbanButton user={user} onDone={refresh} />
                        ) : (
                          <BanUserDialog user={user} onDone={refresh} />
                        )}
                        <RemoveUserDialog user={user} onDone={refresh} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <span className="text-xs text-muted-foreground">
            共 {total} 个用户 · 第 {currentPage}/{totalPages} 页
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

// --- Create User Dialog ---

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!email || !password) {
      toast.error('邮箱和密码为必填项')
      return
    }

    setSubmitting(true)
    try {
      const res = await authClient.admin.createUser({
        email,
        password,
        name: name || undefined,
        role,
      })

      if (res.error) {
        toast.error(res.error.message || '创建用户失败')
        return
      }

      toast.success('用户创建成功')
      setOpen(false)
      setName('')
      setEmail('')
      setPassword('')
      setRole('user')
    } catch {
      toast.error('创建用户出错')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm">
        <PlusIcon className="size-4" />
        创建用户
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建用户</DialogTitle>
          <DialogDescription>填写信息以创建新用户账号</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">用户名</Label>
            <Input
              id="c-name"
              placeholder="可选，留空则使用邮箱前缀"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-email">邮箱 *</Label>
            <Input
              id="c-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-password">密码 *</Label>
            <Input
              id="c-password"
              type="password"
              placeholder="至少 8 位字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-role">角色</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="c-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
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
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className="size-4 animate-spin mr-1" />
            ) : (
              <PlusIcon className="size-4 mr-1" />
            )}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Set Role Dialog ---

function SetRoleDialog({ user, onDone }: { user: User; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState(user.role || 'user')
  const [submitting, setSubmitting] = useState(false)

  const handleSetRole = async () => {
    setSubmitting(true)
    try {
      const res = await authClient.admin.setRole({
        userId: user.id,
        role,
      })

      if (res.error) {
        toast.error(res.error.message || '设置角色失败')
        return
      }

      toast.success(`已将 ${user.name || user.email} 的角色设为 ${role}`)
      setOpen(false)
      onDone()
    } catch {
      toast.error('设置角色出错')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setRole(user.role || 'user')
      }}
    >
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <ShieldIcon className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>设置用户角色</DialogTitle>
          <DialogDescription>
            为用户{' '}
            <span className="font-medium">{user.name || user.email}</span>{' '}
            设置角色
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sr-role">角色</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="sr-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
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
          <Button onClick={handleSetRole} disabled={submitting}>
            {submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Set Password Dialog ---

function SetPasswordDialog({
  user,
  onDone,
}: {
  user: User
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSetPassword = async () => {
    if (!password || password.length < 8) {
      toast.error('密码至少需要 8 位字符')
      return
    }

    setSubmitting(true)
    try {
      const res = await authClient.admin.setUserPassword({
        userId: user.id,
        newPassword: password,
      })

      if (res.error) {
        toast.error(res.error.message || '设置密码失败')
        return
      }

      toast.success(`已为 ${user.name || user.email} 设置新密码`)
      setOpen(false)
      setPassword('')
      onDone()
    } catch {
      toast.error('设置密码出错')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setPassword('')
      }}
    >
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <LockIcon className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>更改密码</DialogTitle>
          <DialogDescription>
            为用户{' '}
            <span className="font-medium">{user.name || user.email}</span>{' '}
            设置新密码
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sp-password">新密码</Label>
            <Input
              id="sp-password"
              type="password"
              placeholder="至少 8 位字符"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          <Button onClick={handleSetPassword} disabled={submitting}>
            {submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Ban User Dialog ---

function BanUserDialog({ user, onDone }: { user: User; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [expiresIn, setExpiresIn] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleBan = async () => {
    setSubmitting(true)
    try {
      const res = await authClient.admin.banUser({
        userId: user.id,
        banReason: reason || undefined,
        banExpiresIn: expiresIn ? Number(expiresIn) : undefined,
      })

      if (res.error) {
        toast.error(res.error.message || '封禁失败')
        return
      }

      toast.success(`${user.name || user.email} 已被封禁`)
      setOpen(false)
      setReason('')
      setExpiresIn('')
      onDone()
    } catch {
      toast.error('封禁操作出错')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setReason('')
          setExpiresIn('')
        }
      }}
    >
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <BanIcon className="size-4 text-destructive" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>封禁用户</DialogTitle>
          <DialogDescription>
            封禁用户{' '}
            <span className="font-medium">{user.name || user.email}</span>，
            封禁后该用户将无法登录，所有会话将被撤销。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ban-reason">封禁原因（可选）</Label>
            <Input
              id="ban-reason"
              placeholder="如：滥发垃圾信息"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ban-expires">封禁期限（秒，可选）</Label>
            <Input
              id="ban-expires"
              type="number"
              placeholder="留空则为永久封禁"
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              常用：86400 = 1天 · 604800 = 7天 · 2592000 = 30天
            </p>
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
          <Button
            variant="destructive"
            onClick={handleBan}
            disabled={submitting}
          >
            {submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
            确认封禁
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Unban Button ---

function UnbanButton({ user, onDone }: { user: User; onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  const handleUnban = async () => {
    setLoading(true)
    try {
      const res = await authClient.admin.unbanUser({ userId: user.id })

      if (res.error) {
        toast.error(res.error.message || '解除封禁失败')
        return
      }

      toast.success(`${user.name || user.email} 已解除封禁`)
      onDone()
    } catch {
      toast.error('解除封禁出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleUnban} disabled={loading}>
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <CircleCheckIcon className="size-4 text-green-600" />
      )}
    </Button>
  )
}

// --- Remove User Dialog ---

function RemoveUserDialog({
  user,
  onDone,
}: {
  user: User
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleRemove = async () => {
    if (confirmText !== user.email) {
      toast.error('请输入正确的邮箱以确认删除')
      return
    }

    setSubmitting(true)
    try {
      const res = await authClient.admin.removeUser({ userId: user.id })

      if (res.error) {
        toast.error(res.error.message || '删除用户失败')
        return
      }

      toast.success(`${user.name || user.email} 已被删除`)
      setOpen(false)
      setConfirmText('')
      onDone()
    } catch {
      toast.error('删除用户出错')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setConfirmText('')
      }}
    >
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Trash2Icon className="size-4 text-destructive" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除用户</DialogTitle>
          <DialogDescription>
            此操作不可撤销。将永久删除用户{' '}
            <span className="font-medium">{user.name || user.email}</span>{' '}
            的所有数据。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rm-confirm">
              请输入邮箱{' '}
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-destructive select-all break-all">
                  {user.email}
                </span>
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-5 rounded hover:bg-muted transition-colors"
                  aria-label="复制邮箱"
                  onClick={() => {
                    navigator.clipboard.writeText(user.email)
                    toast.success('已复制到剪贴板')
                  }}
                >
                  <CopyIcon className="size-3 text-muted-foreground" />
                </button>
              </span>{' '}
              以确认：
            </Label>
            <Input
              id="rm-confirm"
              placeholder={user.email}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
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
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={submitting || confirmText !== user.email}
          >
            {submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
