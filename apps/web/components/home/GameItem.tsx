import type { homeData } from '@web/app/(app)/(home)/(action)/homeData'
import type { getVnListByTag } from '@web/app/(app)/tags/[tagid]/(acrion)/tagvns'
import { getImageUrl, imageAcc } from '@web/lib/ImageUrl'
import Link from 'next/link'
import { GameCard } from '../game-card'

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
  if (item?.other && item.other_datas?.other_media?.length) {
    imagesData =
      item.other_datas.other_media.find((item) => item.cover)?.media ?? item.images
  } else {
    if (item?.images !== null) imagesData = item?.images
    else imagesData = {}
  }

  let imagess = '/No-Image-Placeholder.svg.webp';

  if (imagesData) {
    if ('hash' in imagesData) {
      imagess = imageAcc(imagesData.name);
    } else if (imagesData.id && imagesData.width && imagesData.height) {
      imagess = getImageUrl({
        imageId: imagesData.id,
        width: imagesData.width,
        height: imagesData.height,
      });
    }
  }

  let title
  if (item?.other_datas) {
    title = item.other_datas?.title?.find(
      (t) => t.lang === 'zh-Hans' && t.title.trim() !== '',
    )?.title
  }
  if (!title) {
    title = item?.titles?.find(
      (t) => t.lang === item.olang && t.title.trim() !== '',
    )?.title
  }

  return (
    <Link href={`/${item?.id}`}>
      <div
        className="hover:shadow-md hover:border rounded-lg"
        style={{ contentVisibility: 'auto' }}
      >
        <GameCard.Image
          width={imagesData?.width ?? 200}
          height={imagesData?.height ?? 300}
          loading="lazy"
          decoding="async"
          src={imagess}
          alt={title || ' '}
        />
      </div>
      <p className="text-sm truncate w-full text-center px-2 pt-2">{title}</p>
    </Link>
  )
}
