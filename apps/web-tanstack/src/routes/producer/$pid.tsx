import { api } from '@libs'
import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { BBCodeRenderer } from '#/components/bbcode'
import { ProducerGamelist } from '#/components/home/producer/ProducerGameList'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { assertOk } from '#/lib/assertOk'

const producerInfo = createServerFn()
  .inputValidator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const producer = await api.producer.info.get({ query: { pid: data.pid } })
    return assertOk(producer, `${data.pid} producer 信息`)
  })

const producerGameList = createServerFn()
  .inputValidator(z.object({ pid: z.string() }))
  .handler(async ({ data }) => {
    const producer = await api.producer.gamelists.get({
      query: { pid: data.pid },
    })
    return assertOk(producer, `${data.pid} producer 游戏列表`)
  })

export const Route = createFileRoute('/producer/$pid')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { pid } = params
    return {
      producer: await producerInfo({ data: { pid } }),
      gameList: producerGameList({ data: { pid } }),
    }
  },
})

function RouteComponent() {
  const { producer } = Route.useLoaderData()

  const relationsMap =
    producer?.producers_relations?.reduce(
      (acc, item) => {
        if (!acc[item.relation]) {
          acc[item.relation] = []
        }
        acc[item.relation].push(item)
        return acc
      },
      {} as Record<string, typeof producer.producers_relations>,
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
        {list.map((item, idx) => (
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
