import { getKv, setKv } from '@api/libs/redis'
import { status } from 'elysia'
import { unique } from 'radash'
import { t } from 'try'
import type { UmamiModel } from './model'
import { db } from '../../libs'
import { jsonArrayFrom } from 'kysely/helpers/postgres'

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

    const url = `${process.env.UMAMI_LOCAL_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=${startAt}&endAt=${endAt}&unit=day&timezone=Asia/Shanghai&page=1&eventName=TagViews&propertyName=tagtitle`

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

    const uniqueById = unique(data, (item) => item.tag)

    void setKv('remfTag', JSON.stringify(uniqueById), 60 * 15)
    type RemfTag = typeof uniqueById
    return uniqueById
  },
  // Game 统计
  async remfGameGet() {
    // const redisData = await getKv('remfGame')
    // if (redisData !== null && redisData !== undefined) {
    //   return JSON.parse(redisData) as RemfGame
    // }
    const [, error, token] = t(await umamiTokenGet())
    if (error)
      throw status(
        500,
        `Umami 服务出错了喵~，Error:${JSON.stringify(error, null, 2)}`,
      )
    const url = `${process.env.UMAMI_LOCAL_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=${startAt}&endAt=${endAt}&unit=day&timezone=Asia/Shanghai&page=1&eventName=GameViews&propertyName=idtitlee`
    const [, error1, res] = t(
      await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    if (error1) throw status(res.status, 'Umami 服务出错了喵~')
    const idlist: UmamiModel.remfGame = await res.json()
    const parsed = idlist.slice(0, 30).map(({ value, total }) => ({
      id: value,
      title: '',
      total,
    }))

    const ids = parsed.map((item) => item.id)
    const rows = await db
      .selectFrom('vn')
      .select((v) => [
        'vn.id',
        'vn.olang',
        jsonArrayFrom(
          v
            .selectFrom('vn_titles')
            .select(['vn_titles.lang', 'vn_titles.title'])
            .whereRef('vn_titles.id', '=', 'vn.id'),
        ).as('titles'),
      ])
      .where('id', 'in', ids)
      .execute()
    const rowsWithTitle = rows.map((row) => {
      const titleObj =
        row.titles.find((t) => t.lang === 'zh-Hans') ||
        row.titles.find((t) => t.lang === 'zh') ||
        row.titles.find((t) => t.lang === row.olang)

      return {
        id: row.id,
        olang: row.olang,
        title: titleObj?.title ?? null,
      }
    })
    const titleMap = new Map(rowsWithTitle.map((r) => [r.id, r.title]))

    const result = unique(parsed, (item) => item.id).map((item) => ({
      ...item,
      title: titleMap.get(item.id) ?? item.title ?? null,
    }))

    void setKv('remfGame', JSON.stringify(result), 60 * 15)

    type RemfGame = typeof result

    return result
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
    const url = `${process.env.UMAMI_LOCAL_URL}/api/websites/${process.env.UMAMI_DATA_WEBSITE_ID}/event-data/values?startAt=1759334400000&endAt=${endAt}&unit=day&timezone=Asia%2FShanghai&path=eq.%2F${vid}&event=GameDownload&propertyName=pathe`

    const [, error1, res] = t(
      await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
    )
    if (error1) throw status(res.status, 'Umami 服务出错了喵~')
    const datas = await res.json()
    const fileMap = new Map<string, number>()
    datas.forEach((item: { value: string; total: number }) => {
      const key = item.value.replace(/\.part\d+\.rar$/, '.rar')
      const prev = fileMap.get(key) ?? 0
      fileMap.set(key, Math.max(prev, item.total))
    })
    const totalDownloads = Array.from(fileMap.values()).reduce(
      (a, b) => a + b,
      0,
    )
    void setKv(`gameDloadNuber-${vid}`, JSON.stringify(totalDownloads), 60 * 15)
    return totalDownloads
  },
}

const umamiTokenGet = async () => {
  const res = await fetch(`${process.env.UMAMI_LOCAL_URL}/api/auth/login`, {
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
