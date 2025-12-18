import { api } from '@libs'
import { getVnDetails } from '@web/lib/repositories/vnRepository'
import type { Metadata } from 'next/types'
import React from 'react'
import { aliasFilter, getTitles } from '../(lib)/contentDataac'
import { ChartAreaLinear } from './(components)/chart-area-linear'

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
    title: '下载统计',
    description: `${
      titlesData.zhHans || titlesData.olang || 'Gamgame'
    } 游戏别名：${aliasData || '无'} 的文件下载统计`,
  }
}

export default async function page({ params }: { params: { id: string } }) {
  const { id } = await params
  const [monthDwData, count] = await Promise.all([
    api.games.gameTimeNumberGet.get({ query: { id, time: 'week' } }),
    api.games.gameTimeNumberGet.get({ query: { id } }),
  ])
  return <ChartAreaLinear data={monthDwData.data} countNumber={count.data} />
}
