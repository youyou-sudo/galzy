import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import { BBCodeRenderer } from '@web/components/bbcode'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { TagViewsTrackEvents } from '@web/components/umami/track-events'
import type { Metadata } from 'next/types'
import React from 'react'
import { getTagData, getVnListByTag } from './(acrion)/tagvns'
import { TagsGamelist } from './(components)/gamelist'
import { AspectRatio } from '@web/components/ui/aspect-ratio'
import Image from 'next/image'

type Props = {
  params: Promise<{ tagid: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tagid } = await params
  const tag = await getTagData(tagid)
  return {
    title: `标签 -  ${tag?.zht_name || tag?.name || '标签'}`,
    description: `${tag?.zht_name || tag?.name || '标签'
      } 类型下的游戏列表，类型介绍：${tag?.zht_description || tag?.description || '无'
      }`,
  }
}
type GetVnListByTagResult = Awaited<ReturnType<typeof getVnListByTag>>
export default async function Yoyo({ params }: Props) {
  const { tagid } = await params
  const tag = await getTagData(tagid)

  const queryClient = new QueryClient()
  await queryClient.prefetchInfiniteQuery({
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

  const tagtitle = `[tag:${tagid}]-[${tag?.zht_name || tag?.name}]`
  return (
    <div className="space-y-3">
      <article>
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="text-2xl text-center items-center">
              {tag?.zht_name || tag?.name}
            </CardTitle>
            <CardContent className="p-0">
              <BBCodeRenderer
                text={tag?.zht_description || tag?.description || ''}
              />
            </CardContent>
          </CardHeader>
        </Card>
      </article>
      {/* 广告 */}
      <aside id="sidebar-ad" className='opacity-80 lg:px-24 px-4 my-4'>
        <AspectRatio ratio={120 / 9}>
          <Image src="/aifywebp.webp" fill alt="AI 风月广告图片" className="object-cover rounded-lg" />
        </AspectRatio>
      </aside>

      <div className="text-sm text-center items-center opacity-30 italic">
        数据过滤，来自 VNDB
      </div>

      <article>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <TagsGamelist tagid={tagid} />
        </HydrationBoundary>
      </article>
      <TagViewsTrackEvents tagtitle={tagtitle} />
    </div>
  )
}
