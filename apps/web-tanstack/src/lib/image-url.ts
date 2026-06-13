type ImageParams = {
  imageId?: string | null
  width?: number | null
  height?: number | null
}

const BASE_URL = 'https://vndb-t.galzy.moe'
const PLACEHOLDER = '/No-Image-Placeholder.svg.webp'

export const getImageUrl = ({
  imageId,
  width,
  height,
}: ImageParams): string => {
  if (!imageId) return PLACEHOLDER

  const prefix = imageId.slice(0, 2)
  const suffix = imageId.slice(-2)
  const body = imageId.slice(2)

  const isLarge = (width ?? 0) > 256 && (height ?? 0) > 400
  const sizePath = isLarge ? `${prefix}.t` : prefix

  return `${BASE_URL}/${sizePath}/${suffix}/${body}.jpg`
}

// export function imageAcc(name: string) {
//   return `${process.env.NEXT_PUBLIC_OPENIMAG_P_HOST}/p/upload/${name}`
// }
