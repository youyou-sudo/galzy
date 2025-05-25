import { Card } from "@/components/ui/card";
import { MobileStatsGridProps } from "./load-balancer-dashboard";

export function MobileStatsGrid({
  dataList,
}: {
  dataList: MobileStatsGridProps[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {dataList.map((stat, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-center space-x-2 mb-2">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="text-xs font-medium text-muted-foreground">
              {stat.title}
            </span>
          </div>
          <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
          <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
        </Card>
      ))}
    </div>
  );
}
