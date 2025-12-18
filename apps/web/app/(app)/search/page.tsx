import { GameCard } from '@web/components/game-card'
import SearchlistComponent from '@web/components/home/Search/meilisearch'
import SearchInput from '@web/components/home/Search/Search'
import { getSearch } from '@web/lib/search/meilisearch'
import { GamepadIcon } from 'lucide-react'
import type { Metadata } from 'next/types'
import React, { Suspense } from 'react'

type Props = {
  searchParams: Promise<{ q: string }>
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { q } = await searchParams
  return {
    title: `搜索 -  ${q || '游戏'}`,
    description: `搜索 - ${q || '游戏'} 搜索结果`,
  }
}

// [x] 用户端搜索
export default async function Youyou({ searchParams }: Props) {
  const { q } = await searchParams
  const gameListData = await getSearch({ q, limit: 100 })
  return (
    <article className="min-h-screen space-y-8">
      <div className="flex items-center justify-center gap-2 mb-4">
        <GamepadIcon className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">游戏搜索</h1>
      </div>

      <div className="mx-auto flex md:w-1/2 items-center justify-center">
        <SearchInput />
      </div>
      <SearchlistComponent gameListData={gameListData} />
    </article>
  )
}
