import { umamiTokenGet } from '@web/lib/umami/token'
import { env } from 'next-runtime-env'
//  [x]
export const remfTagGet = async () => {
  const token = await umamiTokenGet()
  const url = `${env('UMAMI_LOCAL_URL')}/api/websites/${env(
    'UMAMI_DATA_WEBSITE_ID',
  )}/event-data/values?startAt=1756051200000&endAt=1756655999999&unit=day&timezone=Asia/Shanghai&eventName=TagViews&propertyName=tagtitle`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  const idlist: { value: string; total: number }[] = await res.json()
  const parsed = idlist.slice(0, 30).map(({ value, total }) => {
    const match = value.match(/^\[tag:(.*?)\]-\[(.*)\]$/)
    return {
      tag: match?.[1] ?? '',
      title: match?.[2] ?? '',
      total,
    }
  })
  return parsed
}
