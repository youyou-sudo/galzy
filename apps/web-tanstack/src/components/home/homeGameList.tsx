import { useInfiniteQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { getImageUrl } from '@web/lib/ImageUrl'
import { getGameList } from '@web/server/game'
import { Button } from '../ui/button'
import { GameCard } from './card'
import { GameItem } from './GameItem'

const apiroute = getRouteApi('/')

const HomeGamelist = () => {
  const {
    gamelist: { gamelist },
  } = apiroute.useLoaderData()
  const {
    data: gameListData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['homeGameList'],
    queryFn: async ({ pageParam }) => {
      const { gamelist } = await getGameList({
        data: { pageIndex: pageParam, pageSize: 24 },
      })
      if (!gamelist) {
        return null
      }
      return gamelist
    },
    initialPageParam: 1,
    initialData: {
      pages: [gamelist],
      pageParams: [0],
    },
    getNextPageParam: (lastPage) =>
      lastPage && lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : null,
  })

  const getNextPage = () => {
    if (hasNextPage) {
      fetchNextPage()
    }
  }

  const gameList = gameListData?.pages.flatMap((page) =>
    page?.items?.map((item) => (
      <GameItem
        key={item.id}
        gameid={String(item.id)}
        width={item.images?.width ?? 200}
        height={item.images?.height ?? 300}
        src={getImageUrl({
          imageId: item.images?.id,
          width: item.images?.width,
          height: item.images?.height,
        })}
        title={
          item?.titles?.find(
            (t) => t.lang === item.olang && t.title.trim() !== '',
          )?.title || 'null'
        }
      />
    )),
  )

  return (
    <>
      <div className="grid grid-cols-3 gap-4 md:grid-cols-6 p-3">
        {gameList}
        {isLoading || isFetchingNextPage ? (
          <>
            <GameCard.ListSkeleton />
            <GameCard.ListSkeleton />
            <GameCard.ListSkeleton />
          </>
        ) : null}
      </div>
      {hasNextPage && (
        <div className="flex justify-center mt-4">
          <Button size="lg" onClick={getNextPage}>
            加载更多
          </Button>
        </div>
      )}
    </>
  )
}

export default HomeGamelist
