"use client"

import React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Settings, Menu, MoreHorizontal, Edit, Pause, Play, Trash2 } from "lucide-react"
import { NodeStatusBadge } from "./components/node-status-badge"
import { LoadChart } from "./components/load-chart"
import { NodeManagementDialog } from "./components/node-management-dialog"
import { MobileNodeCard } from "./components/mobile-node-card"
import { MobileStatsGrid } from "./components/mobile-stats-grid"
import { MobileCharts } from "./components/mobile-charts"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

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

export default function LoadBalancerDashboard() {
  const [balancingMethod, setBalancingMethod] = useState("round-robin")
  const [isMobile, setIsMobile] = useState(false)

  // 检测屏幕尺寸
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const nodes: Node[] = [
    {
      id: "1",
      name: "Web-Server-01",
      ip: "192.168.1.101",
      port: 8080,
      status: "healthy",
      load: 45,
      connections: 234,
      weight: 10,
      region: "us-east",
      enabled: true,
      responseTime: 120,
    },
    {
      id: "2",
      name: "Web-Server-02",
      ip: "192.168.1.102",
      port: 8080,
      status: "warning",
      load: 78,
      connections: 456,
      weight: 8,
      region: "us-east",
      enabled: true,
      responseTime: 180,
    },
    {
      id: "3",
      name: "Web-Server-03",
      ip: "192.168.1.103",
      port: 8080,
      status: "healthy",
      load: 32,
      connections: 123,
      weight: 10,
      region: "us-west",
      enabled: true,
      responseTime: 95,
    },
    {
      id: "4",
      name: "Web-Server-04",
      ip: "192.168.1.104",
      port: 8080,
      status: "offline",
      load: 0,
      connections: 0,
      weight: 5,
      region: "eu-central",
      enabled: false,
      responseTime: 0,
    },
  ]

  const cpuData = [65, 59, 80, 81, 56, 55, 40, 45, 67, 72, 68, 75]
  const memoryData = [28, 48, 40, 19, 86, 27, 90, 65, 45, 32, 55, 60]
  const networkData = [12, 19, 3, 5, 2, 3, 8, 15, 22, 18, 25, 30]

  const healthyNodes = nodes.filter((node) => node.status === "healthy").length
  const totalConnections = nodes.reduce((sum, node) => sum + node.connections, 0)
  const avgResponseTime = Math.round(
    nodes.filter((node) => node.enabled).reduce((sum, node) => sum + node.responseTime, 0) /
      nodes.filter((node) => node.enabled).length,
  )

  const handleNodeToggle = (nodeId: string) => {
    // 处理节点启用/禁用逻辑
    console.log("Toggle node:", nodeId)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Mobile Header */}
        {isMobile ? (
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" className="p-2">
                  <Menu className="h-4 w-4" />
                </Button>
                <h1 className="text-lg font-bold">负载均衡</h1>
              </div>
              <NodeManagementDialog />
            </div>

            {/* Mobile Algorithm Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">算法:</span>
              <Select value={balancingMethod} onValueChange={setBalancingMethod}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round-robin">轮询</SelectItem>
                  <SelectItem value="least-connections">最少连接</SelectItem>
                  <SelectItem value="weighted">加权轮询</SelectItem>
                  <SelectItem value="ip-hash">IP 哈希</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          /* Desktop Header */
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">负载均衡管理</h1>
              <p className="text-gray-600 mt-1">监控和管理您的服务器节点</p>
            </div>
            <div className="flex items-center space-x-4">
              <NodeManagementDialog />
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Stats Section */}
          {isMobile ? (
            <MobileStatsGrid
              healthyNodes={healthyNodes}
              totalNodes={nodes.length}
              totalConnections={totalConnections}
              avgResponseTime={avgResponseTime}
              balancingMethod={balancingMethod}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">健康节点</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {healthyNodes}/{nodes.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((healthyNodes / nodes.length) * 100)}% 可用性
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总连接数</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalConnections.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">活跃连接</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">平均响应时间</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgResponseTime}ms</div>
                  <p className="text-xs text-muted-foreground">过去 5 分钟</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">负载均衡算法</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={balancingMethod} onValueChange={setBalancingMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round-robin">轮询</SelectItem>
                      <SelectItem value="least-connections">最少连接</SelectItem>
                      <SelectItem value="weighted">加权轮询</SelectItem>
                      <SelectItem value="ip-hash">IP 哈希</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts Section */}
          {isMobile ? (
            <MobileCharts cpuData={cpuData} memoryData={memoryData} networkData={networkData} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <LoadChart data={cpuData} title="CPU 使用率" color="#3b82f6" />
              <LoadChart data={memoryData} title="内存使用率" color="#10b981" />
              <LoadChart data={networkData} title="网络流量" color="#f59e0b" />
            </div>
          )}

          {/* Nodes Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">节点列表</h2>
              <span className="text-sm text-muted-foreground">{nodes.length} 个节点</span>
            </div>

            {isMobile ? (
              /* Mobile Node Cards */
              <div className="space-y-3">
                {nodes.map((node) => (
                  <MobileNodeCard key={node.id} node={node} onToggle={handleNodeToggle} />
                ))}
              </div>
            ) : (
              /* Desktop Table */
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>节点名称</TableHead>
                        <TableHead>地址</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>负载</TableHead>
                        <TableHead>连接数</TableHead>
                        <TableHead>权重</TableHead>
                        <TableHead>区域</TableHead>
                        <TableHead>响应时间</TableHead>
                        <TableHead>启用</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nodes.map((node) => (
                        <TableRow key={node.id}>
                          <TableCell className="font-medium">{node.name}</TableCell>
                          <TableCell>
                            {node.ip}:{node.port}
                          </TableCell>
                          <TableCell>
                            <NodeStatusBadge status={node.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    node.load > 80 ? "bg-red-500" : node.load > 60 ? "bg-yellow-500" : "bg-green-500"
                                  }`}
                                  style={{ width: `${node.load}%` }}
                                />
                              </div>
                              <span className="text-sm">{node.load}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{node.connections}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{node.weight}</Badge>
                          </TableCell>
                          <TableCell>{node.region}</TableCell>
                          <TableCell>{node.responseTime}ms</TableCell>
                          <TableCell>
                            <Switch checked={node.enabled} />
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
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
    </div>
  )
}
