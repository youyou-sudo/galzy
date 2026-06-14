import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { SearchIcon, UsersIcon } from 'lucide-react'

export const Route = createFileRoute('/admin/_authL/')({
  component: RouteComponent,
})

const adminLinks = [
  {
    to: '/admin/users',
    icon: UsersIcon,
    title: '用户管理',
    description: '管理用户账号、角色、封禁与权限',
  },
  {
    to: '/admin/meilisearch',
    icon: SearchIcon,
    title: 'Meilisearch 管理',
    description: '管理搜索引擎的配置、索引与属性',
  },
]

function RouteComponent() {
  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">管理后台</h1>
        <p className="text-muted-foreground mt-1">
          欢迎回来，这里可以管理站点的各项配置
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {adminLinks.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
