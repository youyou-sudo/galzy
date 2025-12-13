'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { GameCard } from '@web/components/game-card'
import { GameItem } from '@web/components/home/GameItem'
import React, { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { getVnListByTag } from '../(acrion)/tagvns'

type GetVnListByTagResult = Awaited<ReturnType<typeof getVnListByTag>>
export const TagsGamelist = ({ tagid }: { tagid: string }) => {
  const { ref, inView } = useInView({ threshold: 0 })

  const {
    data: gameListData,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['TagGameList', tagid],
    queryFn: async ({ pageParam }) => {
      return await getVnListByTag(tagid, 24, pageParam)
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: GetVnListByTagResult) =>
      lastPage && lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : null,
  })

  // 无限加载触发
  useEffect(() => {
    if (inView && !isLoading && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, isLoading, hasNextPage, fetchNextPage])
  const gameList = gameListData?.pages.flatMap((page) =>
    page?.items.map((item) => <GameItem key={item!.id} item={item} />),
  )

  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {gameList}
      {hasNextPage && (
        <>
          <GameCard.ListSkeleton ref={ref} />
          <GameCard.ListSkeleton />
          <GameCard.ListSkeleton />
        </>
      )}
    </div>
  )
}
