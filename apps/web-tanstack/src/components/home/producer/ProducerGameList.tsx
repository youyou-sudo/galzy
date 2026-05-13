import { Await, getRouteApi } from '@tanstack/react-router'
import { getImageUrl } from '#/lib/ImageUrl'
import { GameCard } from '../card'
import { GameItem } from '../GameItem'

const apiroute = getRouteApi('/producer/$pid')

export const ProducerGamelist = () => {
  const { gameList } = apiroute.useLoaderData()

  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6 p-3">
      <Await
        promise={gameList}
        fallback={
          <>
            <GameCard.ListSkeleton />
            <GameCard.ListSkeleton />
            <GameCard.ListSkeleton />
          </>
        }
      >
        {(gameList) => (
          <>
            {!gameList || gameList.length === 0 ? (
              <div className="text-center items-center">没找相关的游戏喵～</div>
            ) : (
              gameList.map((item) => {
                if (!item) return null

                const title =
                  item.titles?.find(
                    (t) => t.lang === item.olang && t.title.trim() !== '',
                  )?.title ?? 'null'

                return (
                  <GameItem
                    key={item.id}
                    gameid={String(item.id)}
                    width={item.image_width ?? 200}
                    height={item.image_height ?? 300}
                    src={getImageUrl({
                      imageId: item.image_id,
                      width: item.image_width,
                      height: item.image_height,
                    })}
                    title={title}
                  />
                )
              })
            )}
          </>
        )}
      </Await>
    </div>
  )
}
