import { Badge } from "@/components/ui/badge"

interface NodeStatusBadgeProps {
  status: "healthy" | "warning" | "error" | "offline"
}

export function NodeStatusBadge({ status }: NodeStatusBadgeProps) {
  const statusConfig = {
    healthy: { label: "健康", variant: "default" as const, className: "bg-green-500 hover:bg-green-600" },
    warning: {
      label: "警告",
      variant: "secondary" as const,
      className: "bg-yellow-500 hover:bg-yellow-600 text-white",
    },
    error: { label: "错误", variant: "destructive" as const, className: "" },
    offline: { label: "离线", variant: "outline" as const, className: "bg-gray-500 hover:bg-gray-600 text-white" },
  }

  const config = statusConfig[status]

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
