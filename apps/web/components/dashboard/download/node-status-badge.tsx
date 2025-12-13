import { Badge } from '@web/components/ui/badge'

interface NodeStatusBadgeProps {
  status: true | false
}

export function NodeStatusBadge({ status }: NodeStatusBadgeProps) {
  const statusConfig = {
    true: {
      label: '在线',
      variant: 'default' as const,
      className: 'bg-green-500',
    },
    false: {
      label: '离线',
      variant: 'outline' as const,
      className: 'bg-red-600 text-white',
    },
  }

  const config = statusConfig[String(status) as 'true' | 'false']

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
