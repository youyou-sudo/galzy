import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import StrategyList from '@web/components/dashboard/dataManagement/strategy/strategyList'
import { getVnDetails } from '@web/lib/repositories/vnRepository'
import { strategyListGet } from '@web/lib/strategy/strategyAc'
import type { Metadata } from 'next/types'
import React from 'react'
import { aliasFilter, getTitles } from '../(lib)/contentDataac'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getVnDetails(id)
  const [titlesData, aliasData] = await Promise.all([
    getTitles({ data }),
    aliasFilter({ data }),
  ])
  return {
    title: '攻略',
    description: `${
      titlesData.zhHans || titlesData.olang || 'Gamgame'
    } 游戏别名：${aliasData || '无'} 的攻略文章列表，`,
  }
}

export default async function page({ params }: { params: { id: string } }) {
  const { id } = await params
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: ['strategyList', id],
    queryFn: () => strategyListGet(id),
  })
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StrategyList id={id} />
    </HydrationBoundary>
  )
}
