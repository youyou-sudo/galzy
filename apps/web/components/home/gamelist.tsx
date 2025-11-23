'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { homeData } from '@web/app/(app)/(home)/(action)/homeData'
import { GameCard } from '@web/components/game-card'
import React, { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { GameItem } from './GameItem'

type HomeDataResult = Awaited<ReturnType<typeof homeData>>

export const HomeGamelist = () => {
  const { ref, inView } = useInView({ threshold: 0 })

  const {
    data: gameListData,
    isLoading,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['gamelist'],
    queryFn: async ({ pageParam }) => {
      const data = await homeData(24, pageParam)
      if (!data) {
        return null
      }
      return data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: HomeDataResult) =>
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
    page?.items?.map((item) => <GameItem key={item.id} item={item} />),
  )

  return (
    <>
      {gameList}
      {hasNextPage && (
        <>
          <GameCard.ListSkeleton ref={ref} />
          <GameCard.ListSkeleton />
          <GameCard.ListSkeleton />
        </>
      )}
    </>
  )
}
