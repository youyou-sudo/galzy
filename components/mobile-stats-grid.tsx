import { Card } from "@/components/ui/card"
import { Server, Activity, Clock, Settings } from "lucide-react"

interface MobileStatsGridProps {
  healthyNodes: number
  totalNodes: number
  totalConnections: number
  avgResponseTime: number
  balancingMethod: string
}

export function MobileStatsGrid({
  healthyNodes,
  totalNodes,
  totalConnections,
  avgResponseTime,
  balancingMethod,
}: MobileStatsGridProps) {
  const stats = [
    {
      title: "健康节点",
      value: `${healthyNodes}/${totalNodes}`,
      subtitle: `${Math.round((healthyNodes / totalNodes) * 100)}% 可用性`,
      icon: Server,
      color: "text-green-600",
    },
    {
      title: "总连接数",
      value: totalConnections.toLocaleString(),
      subtitle: "活跃连接",
      icon: Activity,
      color: "text-blue-600",
    },
    {
      title: "响应时间",
      value: `${avgResponseTime}ms`,
      subtitle: "平均响应",
      icon: Clock,
      color: "text-orange-600",
    },
    {
      title: "负载算法",
      value:
        balancingMethod === "round-robin"
          ? "轮询"
          : balancingMethod === "least-connections"
            ? "最少连接"
            : balancingMethod === "weighted"
              ? "加权轮询"
              : "IP哈希",
      subtitle: "当前算法",
      icon: Settings,
      color: "text-purple-600",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-center space-x-2 mb-2">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="text-xs font-medium text-muted-foreground">{stat.title}</span>
          </div>
          <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
        </Card>
      ))}
    </div>
  )
}
