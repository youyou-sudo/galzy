import { TagGamelist } from '@web/components/home/tag/tagGameList'
import { Card, CardHeader, CardTitle } from '@web/components/ui/card'

export default function TagDetailPage({ tag }: { tag: any }) {
  return (
    <>
      <section className="space-y-3 w-full">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl text-center items-center">
              {tag?.zht_name || tag?.name}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>
      <div className="text-sm text-center items-center opacity-30 italic">
        相关游戏，过滤自 VNDB
      </div>
      <section>
        <TagGamelist />
      </section>
    </>
  )
}
