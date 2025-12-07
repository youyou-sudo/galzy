import { env } from 'next-runtime-env'

type ImageParams = {
  imageId?: string | null
  width?: number | null
  height?: number | null
}

export const getImageUrl = ({ imageId, width, height }: ImageParams) => {
  if (!imageId) {
    return '/No-Image-Placeholder.svg.webp'
  }

  return width && width > 256 && height && height > 400
    ? `${env('NEXT_PUBLIC_VNDBIMG_URI')}/${imageId.substring(
        0,
        2,
      )}.t/${imageId.slice(-2)}/${imageId.slice(2)}.jpg`
    : `${env('NEXT_PUBLIC_VNDBIMG_URI')}/${imageId.substring(
        0,
        2,
      )}/${imageId.slice(-2)}/${imageId.slice(2)}.jpg`
}
