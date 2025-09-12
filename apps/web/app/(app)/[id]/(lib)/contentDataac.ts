import { getImageUrl, imageAcc } from '@web/lib/ImageUrl'
import type { getVnDetails } from '@web/lib/repositories/vnRepository'

type VnData = Awaited<ReturnType<typeof getVnDetails>>
type Props = {
  data: VnData
}
export const getTitles = ({ data }: Props) => {
  if (!data) return {}
  const zhHansTitle =
    data.other_datas?.title?.find(
      (it: { lang: string }) => it.lang === 'zh-Hans',
    )?.title ??
    data.vn_datas?.titles?.find((it: { lang: string }) => it.lang === 'zh-Hans')
      ?.title

  const olangTitle =
    data.vn_datas?.titles.find(
      (it: { lang: string }) => it.lang === data!.vn_datas?.olang,
    )?.title ?? null

  return {
    zhHans: zhHansTitle,
    olang: olangTitle,
  }
}

export const imageFilter = ({ data }: Props) =>
  data?.other && data.other_datas?.media?.some((item) => item.cover)
    ? data.other_datas?.media?.find((item) => item.cover)?.media_datas
    : data?.vn_datas?.images

export const aliasFilter = ({ data }: Props) => {
  return data?.other_datas?.alias ?? data?.vn_datas?.alias ?? ''
}

export const getCoverImageUrl = ({ data }: Props) => {
  const filteredImage = imageFilter({ data })
  const imageUrl =
    filteredImage &&
    typeof filteredImage === 'object' &&
    'hash' in filteredImage
      ? imageAcc(filteredImage.name)
      : getImageUrl({
          imageId: filteredImage!.id,
          width: filteredImage!.width,
          height: filteredImage!.height,
        })
  return imageUrl
}
