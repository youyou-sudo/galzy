'use client'

import { Switch } from '@web/components/animate-ui/radix/switch'
import { Button } from '@web/components/ui/button'
import { Card, CardContent, CardHeader } from '@web/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@web/components/ui/dropdown-menu'
import type { workerDataGet } from '@web/lib/dashboard/download/Cloudflare/workerDataPull'
import { nodeEnaledAc } from '@web/lib/dashboard/download/nodeEnabledAc'
import { formatBytes } from '@web/lib/formatBytes'
import {
  Activity,
  ArrowDownUp,
  BanknoteX,
  Edit,
  Loader2,
  MoreHorizontal,
  Server,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { NodeStatusBadge } from './node-status-badge'

export type WorkerData = Awaited<ReturnType<typeof workerDataGet>>
type NoNullWorkerData = NonNullable<WorkerData>

import { Progress } from '@web/components/animate-ui/radix/progress'

export function MobileNodeCard({
  node,
  refetchAction,
}: {
  node: NoNullWorkerData[number]
  refetchAction: () => void
}) {
  const [switchLoading, setSwitchLoading] = useState(false)
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">{node.woker_name}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <NodeStatusBadge status={Boolean(node.state)} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem></DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{node.url_endpoint}</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>额度</span>
            <span>{Math.round((node.requests / 100000) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <Progress value={Math.round((node.requests / 100000) * 100)} />
          </div>
        </div>
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <Activity className="h-3 w-3 text-muted-foreground mr-1" />
            </div>
            <div className="text-lg font-semibold">{String(node.requests)}</div>
            <div className="text-xs text-muted-foreground">请求总数</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <ArrowDownUp className="h-3 w-3 text-muted-foreground mr-1" />
            </div>
            <div className="text-lg font-semibold whitespace-nowrap">
              {formatBytes(node.responseBodySize)}
            </div>
            <div className="text-xs text-muted-foreground">流量</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <BanknoteX className="h-3 w-3 text-muted-foreground mr-1" />
            </div>
            <div className="text-lg font-semibold">{node.errors}</div>
            <div className="text-xs text-muted-foreground">错误</div>
          </div>
        </div>

        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">启用节点</span>
          <Switch
            thumbIcon={
              switchLoading ? <Loader2 className="animate-spin" /> : null
            }
            checked={node.enable}
            onClick={async () => {
              await setSwitchLoading(true)
              await nodeEnaledAc(node.id, !node.enable)
              await refetchAction()
              await new Promise((resolve) => setTimeout(resolve, 500))
              await setSwitchLoading(false)
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
