import { getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { t } from 'try'
import type { UmamiModel } from './model'

const now = new Date()

const day = now.getDay()
const diff = day === 0 ? 6 : day - 1
const startOfWeek = new Date(
  now.getFullYear(),
  now.getMonth(),
  now.getDate() - diff,
  0,
  0,
  0,
  0,
)
const endAt = now.getTime()
const startAt = startOfWeek.getTime()

export const Umami = {
  // Tag 统计
  async remfTagGet() {
    const redisData = await getKv('remfTag')
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as RemfTag
    }
    const [, error, token] = t(await umamiTokenGet())
    if (error)
      throw status(
        500,
        `Umami 服务出错了喵~，Error:${JSON.stringify(error, null, 2)}`,
      )

    const url = `${process.env.UMAMI_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=${startAt}&endAt=${endAt}&unit=day&timezone=Asia/Shanghai&eventName=TagViews&propertyName=tagtitle`

    const [, error1, res] = t(
      await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    if (error1) throw status(res.status, 'Umami 服务出错了喵~')
    const idlist: UmamiModel.remfTag = await res.json()
    const data = idlist.slice(0, 30).map(({ value, total }) => {
      const match = value.match(/^\[tag:(.*?)\]-\[(.*)\]$/)
      const dats = {
        tag: match?.[1] ?? '',
        title: match?.[2] ?? '',
        total,
      }
      return dats
    })
    void setKv('remfTag', JSON.stringify(data), 60 * 15)
    type RemfTag = typeof data
    return data
  },
  // Game 统计
  async remfGameGet() {
    const redisData = await getKv('remfGame')
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as RemfGame
    }
    const [, error, token] = t(await umamiTokenGet())
    if (error)
      throw status(
        500,
        `Umami 服务出错了喵~，Error:${JSON.stringify(error, null, 2)}`,
      )
    const url = `${process.env.UMAMI_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=${startAt}&endAt=${endAt}&unit=day&timezone=Asia/Shanghai&eventName=GameViews&propertyName=idtitlee`
    const [, error1, res] = t(
      await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    if (error1) throw status(res.status, 'Umami 服务出错了喵~')
    const idlist: UmamiModel.remfGame = await res.json()
    const parsed = idlist.slice(0, 30).map(({ value, total }) => {
      const match = value.match(/^\[id:(.*?)\]-\[(.*)\]$/)
      return {
        id: match?.[1] ?? '',
        title: match?.[2] ?? '',
        total,
      }
    })
    void setKv('remfGame', JSON.stringify(parsed), 60 * 15)
    type RemfGame = typeof parsed
    return parsed
  },
  async gameDloadNuber({ vid }: UmamiModel.gameDloadNuber) {
    const redisData = await getKv(`gameDloadNuber-${vid}`)
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as number
    }
    const [, error, token] = t(await umamiTokenGet())
    if (error)
      throw status(
        500,
        `Umami 服务出错了喵~，Error:${JSON.stringify(error, null, 2)}`,
      )
    const url = `${process.env.UMAMI_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=1759334400000&endAt=${endAt}&unit=day&timezone=Asia%2FShanghai&path=eq.%2F${vid}&event=GameDownload&propertyName=pathe`

    const [, error1, res] = t(
      await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    if (error1) throw status(res.status, 'Umami 服务出错了喵~')
    const datas = await res.json()
    const fileMap = new Map<string, number>();
    datas.forEach((item: { value: string; total: number }) => {
      const key = item.value.replace(/\.part\d+\.rar$/, '.rar');
      const prev = fileMap.get(key) ?? 0;
      fileMap.set(key, Math.max(prev, item.total));
    });
    const totalDownloads = Array.from(fileMap.values()).reduce((a, b) => a + b, 0);
    void setKv(`gameDloadNuber-${vid}`, JSON.stringify(totalDownloads), 60 * 15)
    return totalDownloads
  },
}

const umamiTokenGet = async () => {
  const res = await fetch(`${process.env.UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: process.env.UMAMI_DATA_USER,
      password: process.env.UMAMI_DATA_PASSWORD,
    }),
  })
  const data = await res.json()
  return data.token
}
