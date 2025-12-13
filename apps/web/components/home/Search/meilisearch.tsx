'use client'
import { GameCard } from '@web/components/game-card'
import ForesightLink from '@web/components/HoverPLink'
import { TagViewsTrackEvents } from '@web/components/umami/track-events'
import { getImageUrl, imageAcc } from '@web/lib/ImageUrl'
import type { getSearch } from '@web/lib/search/meilisearch'

type Datas = Awaited<ReturnType<typeof getSearch>>

const SearchlistComponent = ({ gameListData }: { gameListData: Datas }) => {
  const gameList = () => {
    return gameListData?.hits.map((item) => {
      const imageFilter = () => {
        const images =
          item.other &&
          item.other_datas?.other_media.some((item: any) => item.cover === true)
            ? item.other_datas.other_media.find(
                (item: any) => item.cover === true,
              )?.media
            : item.images
        return images
      }
      const imagesData = imageFilter()
      let imagess = '/No-Image-Placeholder.svg.webp'

      if (imagesData) {
        if ('hash' in imagesData) {
          imagess = imageAcc(imagesData.name)
        } else if (imagesData.id && imagesData.width && imagesData.height) {
          imagess = getImageUrl({
            imageId: imagesData.id,
            width: imagesData.width,
            height: imagesData.height,
          })
        }
      }

      return (
        <ForesightLink href={`/${item.id}`} key={item.id}>
          <div>
            {/* [x] VNDB 来源图片进行缓存以防止滥用 VNDB 服务
             */}
            <GameCard.Image
              width={imagesData?.width ?? 200}
              height={imagesData?.height ?? 300}
              loading="lazy"
              src={imagess}
              alt="图片"
            />
          </div>
          <p className="text-sm truncate w-full text-center pl-2 pr-2 pt-2">
            {item.other_datas?.title?.length
              ? (item.other_datas.title.find(
                  (it: { lang: string }) => it.lang === 'zh-Hans',
                )?.title ?? item.other_datas.title[0]?.title)
              : item.titles.find(
                  (it: { lang: string }) => it.lang === item.olang,
                )?.title}
          </p>
        </ForesightLink>
      )
    })
  }
  const tagtitle = `[tag:${gameListData?.topTag?.id}]-[${gameListData?.topTag?.zh_name}]`
  if ((gameListData?.hits ?? []).length === 0) {
    return (
      <div className="flex text-center font-bold justify-center items-center">
        喵~没有找到哦 🐾，可以尝试其他关键字喵～💕
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
      {gameList()}
      {gameListData?.topTag && <TagViewsTrackEvents tagtitle={tagtitle} />}
    </div>
  )
}

export default SearchlistComponent
