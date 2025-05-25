"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Edit, Play, Pause, Trash2, Server, Activity, Clock } from "lucide-react"
import { NodeStatusBadge } from "./node-status-badge"

interface Node {
  id: string
  name: string
  ip: string
  port: number
  status: "healthy" | "warning" | "error" | "offline"
  load: number
  connections: number
  weight: number
  region: string
  enabled: boolean
  responseTime: number
}

interface MobileNodeCardProps {
  node: Node
  onToggle: (id: string) => void
}

export function MobileNodeCard({ node, onToggle }: MobileNodeCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">{node.name}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <NodeStatusBadge status={node.status} />
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
                <DropdownMenuItem>
                  {node.enabled ? (
                    <>
                      <Pause className="mr-2 h-4 w-4" />
                      禁用
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      启用
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {node.ip}:{node.port} • {node.region}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Load Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>负载</span>
            <span>{node.load}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                node.load > 80 ? "bg-red-500" : node.load > 60 ? "bg-yellow-500" : "bg-green-500"
              }`}
              style={{ width: `${node.load}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <Activity className="h-3 w-3 text-muted-foreground mr-1" />
            </div>
            <div className="text-lg font-semibold">{node.connections}</div>
            <div className="text-xs text-muted-foreground">连接数</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center">
              <Clock className="h-3 w-3 text-muted-foreground mr-1" />
            </div>
            <div className="text-lg font-semibold">{node.responseTime}ms</div>
            <div className="text-xs text-muted-foreground">响应时间</div>
          </div>
          <div className="space-y-1">
            <Badge variant="outline" className="text-xs">
              权重 {node.weight}
            </Badge>
            <div className="text-xs text-muted-foreground">负载权重</div>
          </div>
        </div>

        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium">启用节点</span>
          <Switch checked={node.enabled} onCheckedChange={() => onToggle(node.id)} />
        </div>
      </CardContent>
    </Card>
  )
}
