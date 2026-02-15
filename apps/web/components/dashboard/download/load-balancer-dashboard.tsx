'use client'

import { useQuery } from '@tanstack/react-query'
import { Progress } from '@web/components/animate-ui/components/radix/progress'
import { Switch } from '@web/components/animate-ui/components/radix/switch'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@web/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table'
import { workerDataGet } from '@web/lib/dashboard/download/Cloudflare/workerDataPull'
import { configFormDel } from '@web/lib/dashboard/download/configForm'
import { nodeEnaledAc } from '@web/lib/dashboard/download/nodeEnabledAc'
import {
  Activity,
  ArrowDownUp,
  BanknoteX,
  Edit,
  Loader2,
  MoreHorizontal,
  Plus,
  Server,
  Trash2,
} from 'lucide-react'
import React, { useState } from 'react'
import { MobileNodeCard } from './mobile-node-card'
import { MobileStatsGrid } from './mobile-stats-grid'
import { NodeManagementDialog } from './node-management-dialog'
import { NodeStatusBadge } from './node-status-badge'
import { downloadStore } from './stores/download'
import { filesize } from 'filesize'

export interface MobileStatsGridProps {
  title: string
  value: any
  subtitle: string
  icon: React.FC<React.SVGProps<SVGSVGElement>>
  color: string
}
export default function LoadBalancerDashboard() {
  const [isMobile, setIsMobile] = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)

  const { data: workersItems, refetch } = useQuery({
    queryKey: ['workersItems'],
    queryFn: async () => {
      const res = await workerDataGet()
      return res
    },
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  })

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const healthyNodes = (workersItems || []).filter(
    (node) => node.state === true,
  ).length
  const totalSize = (workersItems ?? []).reduce(
    (sum, item) => sum + +item.responseBodySize,
    0,
  )

  const dataList: MobileStatsGridProps[] = [
    {
      title: '节点',
      value: `${healthyNodes}/${workersItems?.length}`,
      subtitle: `${workersItems && workersItems.length > 0
        ? Math.round((healthyNodes / workersItems.length) * 100)
        : 0
        }% 可用性`,
      icon: Server,
      color: 'text-green-600',
    },
    {
      title: '请求',
      value: (workersItems ?? []).reduce(
        (sum, item) => sum + +item.requests,
        0,
      ),
      subtitle: '活跃连接',
      icon: Activity,
      color: 'text-blue-600',
    },
    {
      title: '总流量',
      value: `${filesize(totalSize)}`,
      subtitle: '本日流量',
      icon: ArrowDownUp,
      color: 'text-purple-600',
    },
    {
      title: '错误',
      value: (workersItems ?? []).reduce((sum, item) => sum + +item.errors, 0),
      subtitle: '总请求错误',
      icon: BanknoteX,
      color: 'text-orange-600',
    },
  ]
  const open = downloadStore((s) => s.open)
  const setData = downloadStore((s) => s.setData)
  const nodeClick = (item?: any) => {
    setData(item)
    open()
  }
  return (
    <div className="">
      {/* Mobile Header */}
      {isMobile ? (
        <div className="sticky top-0 border-b z-10 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <h1 className="text-lg font-bold">负载均衡</h1>
              <p className="opacity-50">（本日数据）</p>
            </div>

            <Button
              onClick={() => {
                nodeClick()
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加节点
            </Button>
            <NodeManagementDialog refetchAction={refetch} />
          </div>
        </div>
      ) : (
        /* Desktop Header */
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">下载节点管理</h1>
            <p className="mt-1 opacity-50">
              监控和管理您的 cloudflare Workers 节点（本日数据）
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => {
                nodeClick()
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加节点
            </Button>
            <NodeManagementDialog refetchAction={refetch} />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Stats Section */}
        {isMobile ? (
          <MobileStatsGrid dataList={dataList} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {dataList.map((item, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center space-x-2 mb-2">
                    <item.icon className={` h-4 w-4 ${item.color}`} />
                    <span className="font-medium text-muted-foreground">
                      {item.title}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${item.color}`}>
                    {item.value}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.subtitle}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Nodes Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">节点列表</h2>
            <span className="text-sm text-muted-foreground">
              {workersItems?.length} 个节点
            </span>
          </div>

          {isMobile ? (
            /* Mobile Node Cards */
            <div className="space-y-3">
              {workersItems?.map((node) => (
                <MobileNodeCard
                  key={node.id}
                  node={node}
                  refetchAction={refetch}
                />
              ))}
            </div>
          ) : (
            /* Desktop Table */
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>节点名称</TableHead>
                      <TableHead>地址</TableHead>
                      <TableHead className="text-center">请求总数</TableHead>
                      <TableHead>错误</TableHead>
                      <TableHead>流量</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>启用</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workersItems?.map((node) => (
                      <TableRow key={node.id}>
                        <TableCell className="font-medium">
                          {node.woker_name}
                        </TableCell>
                        <TableCell>{node.url_endpoint}</TableCell>
                        <TableCell className="text-center">
                          {node.requests}
                          <Progress
                            value={Math.round((node.requests / 100000) * 100)}
                          />
                        </TableCell>
                        <TableCell>{node.errors}</TableCell>
                        <TableCell>
                          {filesize(node.responseBodySize)}
                        </TableCell>
                        <TableCell>
                          <NodeStatusBadge status={node.state} />
                        </TableCell>
                        <TableCell className="flex items-center flex-row">
                          <Switch
                            thumbIcon={
                              switchLoading ? (
                                <Loader2 className="animate-spin" />
                              ) : null
                            }
                            checked={node.enable}
                            disabled={switchLoading}
                            onClick={async () => {
                              setSwitchLoading(true)
                              await nodeEnaledAc(node.id, !node.enable)
                              await refetch()
                              await new Promise((resolve) =>
                                setTimeout(resolve, 500),
                              )
                              setSwitchLoading(false)
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  nodeClick(node)
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={async () => {
                                  try {
                                    await configFormDel(node.id)
                                    refetch()
                                  } finally {
                                  }
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
