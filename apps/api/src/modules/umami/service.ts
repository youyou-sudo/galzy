import { getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { t } from 'try'
import type { UmamiModel } from './model'

export const Umami = {
  // Tag 统计
  async remfTagGet() {
    const redisData = await getKv('remfTag')
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as RemfTag
    }
    const [, error, token] = await t(umamiTokenGet())
    if (error)
      throw status(
        500,
        `Umami 服务出错了喵~，Error:${JSON.stringify(error, null, 2)}`,
      )
    const url = `${process.env.UMAMI_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=1756051200000&endAt=1756655999999&unit=day&timezone=Asia/Shanghai&eventName=TagViews&propertyName=tagtitle`
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
    const [, error, token] = await t(umamiTokenGet())
    if (error)
      throw status(
        500,
        `Umami 服务出错了喵~，Error:${JSON.stringify(error, null, 2)}`,
      )
    const url = `${process.env.UMAMI_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=1756051200000&endAt=1756655999999&unit=day&timezone=Asia/Shanghai&eventName=GameViews&propertyName=idtitlee`
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
