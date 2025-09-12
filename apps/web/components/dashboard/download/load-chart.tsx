import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'

interface LoadChartProps {
  data: number[]
  title: string
  color: string
}

export function LoadChart({ data, title, color }: LoadChartProps) {
  const maxValue = Math.max(...data, 100)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end space-x-1 h-16">
          {data.map((value, index) => (
            <div
              key={index}
              className="flex-1 rounded-t"
              style={{
                height: `${(value / maxValue) * 100}%`,
                backgroundColor: color,
                minHeight: '2px',
              }}
            />
          ))}
        </div>
        <div className="text-2xl font-bold mt-2">{data[data.length - 1]}%</div>
      </CardContent>
    </Card>
  )
}
