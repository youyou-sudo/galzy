import { TagsCard } from '@web/app/(app)/[id]/(components)/tags'
import { BBCodeRenderer } from '@web/components/bbcode'
import Errors from '@web/components/error'
import { Card, CardContent } from '@web/components/ui/card'
import type { getVnDetails } from '@web/lib/repositories/vnRepository'
import Image from 'next/image'
import React from 'react'
import {
  aliasFilter,
  getCoverImageUrl,
  getTitles,
  imageFilter,
} from '../../(lib)/contentDataac'
import { isEqual } from 'radash'

type VnData = Awaited<ReturnType<typeof getVnDetails>>
type Props = {
  data: VnData
}
export const ContentCard = ({ data }: Props) => {
  if (!data) {
    return (
      <div>
        <Errors code="400" />
      </div>
    )
  }
  const filteredImage = imageFilter({ data })
  const titlesData = getTitles({ data })
  const aliasData = aliasFilter({ data })
  const imageUrl = getCoverImageUrl({ data })

  return (
    <article>
      <Card className="overflow-hidden wrap-break-word border-0 pb-0 ">
        <CardContent>
          {/* Cover and basic info section */}
          <div className="sm:float-right text-center sm:text-right sm:ml-4 pb-4 relative">
            <div className="relative inline-block">
              <div
                className={`${
                  filteredImage && filteredImage.height < filteredImage.width
                    ? 'min-w-[290px]'
                    : 'max-w-[220px]'
                } relative overflow-hidden text-left`}
              >
                <Image
                  width={filteredImage?.width ?? 300}
                  height={filteredImage?.height ?? 200}
                  className="w-full h-full relative z-10 rounded transform shadow-lg"
                  src={imageUrl}
                  alt="游戏图片"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          {/* Main content section */}
          <div className="overflow-hidden wrap-break-word">
            {/* Title section */}
            {titlesData.olang && titlesData.zhHans && !isEqual(titlesData.olang, titlesData.zhHans) && (
              <div className="text-sm leading-[1.2]">{titlesData.olang}</div>
            )}

            <h1 className="font-bold text-2xl leading-[1.2] mt-2">
              {titlesData.zhHans || titlesData.olang}
            </h1>

            {/* Aliases */}
            {aliasData && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-[1.2]">
                别名:{' '}
                {aliasData
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .filter((s) => s !== titlesData.zhHans)
                  .join(', ')}
              </div>
            )}

            {/* Description */}
            {(data.other_datas?.description || data.vn_datas?.description) && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 uppercase mb-1">
                  游戏简介
                </div>
                <div className="text-sm line-clamp-6  leading-relaxed text-gray-800 dark:text-gray-200">
                  <BBCodeRenderer
                    text={
                      data.other_datas?.description ||
                      data.vn_datas?.description ||
                      ''
                    }
                  />
                </div>
              </div>
            )}

            {/* Tags section */}
            {data.vid && <TagsCard id={data.vid} />}
          </div>
        </CardContent>
      </Card>
    </article>
  )
}
