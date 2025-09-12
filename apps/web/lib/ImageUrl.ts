import { env } from 'next-runtime-env'
export const getImageUrl = ({
  imageId,
  width,
  height,
}: {
  imageId: string
  width: number
  height: number
}) => {
  if (!imageId) {
    return ''
  }
  return width && width > 256 && height > 400
    ? `${env('NEXT_PUBLIC_VNDBIMG_URI')}/${imageId.substring(
        0,
        2,
      )}.t/${imageId.slice(-2)}/${imageId.slice(2)}.jpg`
    : `${env('NEXT_PUBLIC_VNDBIMG_URI')}/${imageId.substring(
        0,
        2,
      )}/${imageId.slice(-2)}/${imageId.slice(2)}.jpg`
}

export function imageAcc(name: string) {
  const res = `${env('NEXT_PUBLIC_OPENIMAG_P_HOST')}/p/upload/${name}`
  return res
}
