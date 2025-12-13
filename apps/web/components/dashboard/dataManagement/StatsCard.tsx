'use client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@shadcn/ui/components/card'
import { useQuery } from '@tanstack/react-query'
import { dataFilteringStats } from '@web/lib/dashboard/dataManagement/dataGet'

export default function StatsCard() {
  const { data: coutData } = useQuery({
    queryKey: ['dataFilteringStats'],
    queryFn: async () => {
      const res = await dataFilteringStats()
      return res
    },
    refetchInterval: 60000,
  })
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="font-medium text-muted-foreground">
                已有资源
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold`}>{coutData?.all}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="font-medium text-muted-foreground">
                补充数据
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold`}>{coutData?.bothExist}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="font-medium text-muted-foreground">
                未补充数据
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold`}>{coutData?.onlyVid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="font-medium text-muted-foreground">NO VNDB</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold`}>{coutData?.onlyOther}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
