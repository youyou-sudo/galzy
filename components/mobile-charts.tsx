import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MobileChartsProps {
  cpuData: number[]
  memoryData: number[]
  networkData: number[]
}

export function MobileCharts({ cpuData, memoryData, networkData }: MobileChartsProps) {
  const charts = [
    { title: "CPU", data: cpuData, color: "#3b82f6", unit: "%" },
    { title: "内存", data: memoryData, color: "#10b981", unit: "%" },
    { title: "网络", data: networkData, color: "#f59e0b", unit: "MB/s" },
  ]

  const getTrend = (data: number[]) => {
    const recent = data.slice(-3)
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    const prev = data.slice(-6, -3)
    const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length

    if (avg > prevAvg + 5) return "up"
    if (avg < prevAvg - 5) return "down"
    return "stable"
  }

  return (
    <div className="space-y-3">
      {charts.map((chart, index) => {
        const currentValue = chart.data[chart.data.length - 1]
        const trend = getTrend(chart.data)
        const maxValue = Math.max(...chart.data, 100)

        return (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{chart.title}使用率</CardTitle>
                <div className="flex items-center space-x-1">
                  {trend === "up" && <TrendingUp className="h-3 w-3 text-red-500" />}
                  {trend === "down" && <TrendingDown className="h-3 w-3 text-green-500" />}
                  {trend === "stable" && <Minus className="h-3 w-3 text-gray-500" />}
                  <span className="text-xs text-muted-foreground">
                    {trend === "up" ? "上升" : trend === "down" ? "下降" : "稳定"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end space-x-1 h-12 mb-2">
                {chart.data.slice(-12).map((value, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${(value / maxValue) * 100}%`,
                      backgroundColor: chart.color,
                      minHeight: "2px",
                      opacity: 0.3 + (idx / 12) * 0.7,
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between items-center">
                <div className="text-xl font-bold" style={{ color: chart.color }}>
                  {currentValue}
                  {chart.unit}
                </div>
                <div className="text-xs text-muted-foreground">过去12分钟</div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
