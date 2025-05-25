import { Badge } from "@/components/ui/badge";

interface NodeStatusBadgeProps {
  status: true | false;
}

export function NodeStatusBadge({ status }: NodeStatusBadgeProps) {
  const statusConfig = {
    true: {
      label: "健康",
      variant: "default" as const,
      className: "bg-green-500 hover:bg-green-600",
    },
    false: {
      label: "离线",
      variant: "outline" as const,
      className: "bg-gray-500 hover:bg-gray-600 text-white",
    },
  };

  const config = statusConfig[String(status) as "true" | "false"];

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
