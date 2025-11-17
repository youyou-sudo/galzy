"use cache"
import { TapCatd } from '@web/app/(app)/[id]/(components)'
import { ContentCard } from '@web/app/(app)/[id]/(components)/vnid-page/ContentCard'
import Errors from '@web/components/error'
import { GameViewsTrackEvents } from '@web/components/umami/track-events'
import { getVnDetails } from '@web/lib/repositories/vnRepository'
import type { Metadata } from 'next'
import type React from 'react'
import {
  aliasFilter,
  getCoverImageUrl,
  getTitles,
  imageFilter,
} from './(lib)/contentDataac'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getVnDetails(id)
  const [titlesData, aliasData, imageUrl, image] = await Promise.all([
    getTitles({ data }),
    aliasFilter({ data }),
    getCoverImageUrl({ data }),
    imageFilter({ data }),
  ])
  return {
    title: {
      default: titlesData.zhHans || titlesData.olang || 'Gamgame',
      template: `${titlesData.zhHans || titlesData.olang || 'Gamgame'} - %s`,
    },
    description: `${
      titlesData.zhHans || titlesData.olang || 'Gamgame'
    } 的资源下载，游戏别名：${aliasData || '无'}`,
    openGraph: {
      images: [
        {
          url: `/_next/image?url=${imageUrl}&w=${image?.width}&q=75`,
          width: image?.width,
          height: image?.height,
        },
      ],
    },
  }
}

export default async function IdLayout({
  children,
  params,
}: LayoutProps<'/[id]'>) {
  const { id } = await params
  const data = await getVnDetails(id)
  const titlesData = getTitles({ data })
  const idtitle = `[id:${id}]-[${titlesData.olang || titlesData.zhHans}]`
  if (!data) {
    return (
      <Errors code="404" errormessage={' ｡ﾟヽ(ﾟ´Д`)ﾉﾟ｡ 游戏未收录 / 找不到喵～'} />
    )
  }
  return (
    <div className="space-y-3">
      <ContentCard data={data} />
      <TapCatd id={id}>{children}</TapCatd>
      <GameViewsTrackEvents idtitle={idtitle} />
    </div>
  )
}
