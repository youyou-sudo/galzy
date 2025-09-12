import type { homeData } from '@web/app/(app)/(home)/(action)/homeData'
import type { getVnListByTag } from '@web/app/(app)/tags/[tagid]/(acrion)/tagvns'
import { getImageUrl, imageAcc } from '@web/lib/ImageUrl'
import { GameCard } from '../game-card'
import Link from 'next/link'

type HomeData = Awaited<ReturnType<typeof homeData>>
type NoNullHomeData = NonNullable<HomeData>
type GameItemTypelbshi = NonNullable<NoNullHomeData['items']>
type GameItemType = GameItemTypelbshi[number]

type TagData = Awaited<ReturnType<typeof getVnListByTag>>
type NoNullTagData = NonNullable<TagData>
type TagGameItemType = NoNullTagData['items'][number]

// 小组件：单个游戏卡片
export const GameItem = ({
  item,
}: {
  item: GameItemType | TagGameItemType
}) => {
  let imagesData
  if (item.other && item.other_datas?.other_media?.length) {
    imagesData =
      item.other_datas.other_media.find((m) => m.cover)?.media ?? item.images
  } else {
    imagesData = item.images
  }
  let imagess
  if (!imagesData) {
    imagess = ''
  } else if ('hash' in imagesData) {
    imagess = imageAcc(imagesData.name)
  } else {
    imagess = getImageUrl({
      imageId: imagesData.id,
      width: imagesData.width,
      height: imagesData.height,
    })
  }

  let title
  if (item.other_datas?.title?.length) {
    title = item.other_datas.title.find(
      (t) => t.lang === 'zh-Hans' && t.title.trim() !== '',
    )?.title
  }
  if (!title) {
    title = item.titles?.find(
      (t) => t.lang === item.olang && t.title.trim() !== '',
    )?.title
  }

  return (
    <Link href={`/${item.id}`}>
      <div className="hover:shadow-md hover:border-1  rounded-lg" style={{ contentVisibility: 'auto' }}
      >
        <GameCard.Image
          width={imagesData?.width}
          height={imagesData?.height}
          loading="lazy"
          decoding="async"
          src={imagess}
          alt={title || ' '}
        />
      </div>
      <p className="text-sm truncate w-full text-center px-2 pt-2">
        {title}
      </p>
    </Link>
  )
}
