import { ButtonCard } from '@web/components/dashboard/taskButton/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Bot, Database, Settings, Tag } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
  const quickLinks = [
    {
      title: '站点配置',
      description: '管理 MeiliSearch 和搜索配置',
      icon: Settings,
      href: '/dashboard/config',
      color: 'text-blue-500',
    },
    {
      title: '数据管理',
      description: '查看和管理数据视图',
      icon: Database,
      href: '/dashboard/dataManagement',
      color: 'text-green-500',
    },
    {
      title: '标签管理',
      description: '编辑和管理标签',
      icon: Tag,
      href: '/dashboard/tag',
      color: 'text-purple-500',
    },
    {
      title: '下载管理',
      description: '管理下载节点和负载均衡',
      icon: Bot,
      href: '/dashboard/download',
      color: 'text-orange-500',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">管理面板</h1>
        <p className="text-muted-foreground">
          欢迎回来！这是您的管理中心，可以快速访问各种管理功能。
        </p>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">快速访问</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <link.icon className={`w-5 h-5 ${link.color}`} />
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                  </div>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* System Actions */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">系统操作</h2>
        <Card>
          <CardHeader>
            <CardTitle>后台任务</CardTitle>
            <CardDescription>
              执行系统维护和数据同步操作
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ButtonCard />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
