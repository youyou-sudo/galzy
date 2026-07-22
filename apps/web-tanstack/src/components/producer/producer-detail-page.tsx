import { Link } from '@tanstack/react-router'
import { BBCodeRenderer } from '@web/components/bbcode'
import { ProducerGamelist } from '@web/components/home/producer/ProducerGameList'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'

export default function ProducerDetailPage({
  producer,
}: {
  producer: any
}) {
  const relationsMap =
    producer?.producers_relations?.reduce(
      (acc: any, item: any) => {
        if (!acc[item.relation]) {
          acc[item.relation] = []
        }
        acc[item.relation].push(item)
        return acc
      },
      {} as Record<string, any>,
    ) ?? {}

  const relationLabels: Record<string, string> = {
    old: '旧名',
    new: '新名',
    sub: '子公司',
    par: '母公司生产商',
    imp: '子品牌 / 品牌',
    ipa: '母公司',
    spa: '分支',
    ori: '原始',
  }

  const renderRelations = (type: string) => {
    const list = relationsMap[type]
    if (!list || list.length === 0) return null

    return (
      <p key={type}>
        {relationLabels[type] ?? type}：
        {list.map((item: any, idx: number) => (
          <span key={item.pid}>
            {idx > 0 && '，'}
            <Link
              to="/producer/$pid"
              params={{ pid: item.pid }}
              className="text-cyan-600 hover:underline"
            >
              {item.name}
            </Link>
          </span>
        ))}
      </p>
    )
  }
  return (
    <>
      <section className="space-y-3 w-full">
        <Card className="w-full">
          <CardHeader className="text-center ">
            <CardTitle className="text-2xl items-center">
              {producer?.name}
            </CardTitle>
            {producer?.alias !== null && (
              <CardDescription>
                {producer?.alias.split('\n').join(', ')}
              </CardDescription>
            )}
            <CardContent className="p-0 text-center">
              {Object.keys(relationsMap).map((type) => renderRelations(type))}
              <BBCodeRenderer text={producer?.description || ''} />
            </CardContent>
          </CardHeader>
        </Card>
      </section>
      <div className="text-sm text-center items-center opacity-30 italic">
        相关游戏，过滤自 VNDB
      </div>
      <section>
        <ProducerGamelist />
      </section>
    </>
  )
}
