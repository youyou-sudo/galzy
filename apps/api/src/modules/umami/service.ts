import { db, sql, vn, vnTitles } from '@api/libs'
import { delKv, getKv, setKv } from '@api/libs/redis'
import { eq, inArray } from 'drizzle-orm'
import { status } from 'elysia'
import { unique } from 'radash'
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
    const redisData = await getKv('galzy:tag:remf')
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

    const result = structuredClone(uniqueById)
    void setKv('galzy:tag:remf', JSON.stringify(result), 60 * 15)
    type RemfTag = typeof result
    return result
  },
  // Game 统计
  async remfGameGet() {
    const redisData = await getKv('galzy:game:remf')
    if (redisData !== null && redisData !== undefined) {
      return JSON.parse(redisData) as RemfGame
    }
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
    const rows = await (db
      .select({
        id: vn.id,
        olang: vn.olang,
        titles: sql`COALESCE((SELECT json_agg(row_to_json(t.*)) FROM (SELECT lang, title FROM ${vnTitles} t WHERE t.id = ${sql.identifier('vn')}.${sql.identifier('id')}) t), '[]'::json)`,
      })
      .from(vn)
      .where(inArray(vn.id, ids)) as any)
    const rowsWithTitle = (
      rows as Array<{
        id: string
        olang: string | null
        titles: Array<{ lang: string; title: string }>
      }>
    ).map((row) => {
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

    const cloned = structuredClone(result)
    void setKv('galzy:game:remf', JSON.stringify(cloned), 60 * 15)

    type RemfGame = typeof cloned

    return cloned
  },
  async gameDloadNuber({ vid }: UmamiModel.gameDloadNuber) {
    const redisData = await getKv(`galzy:game:download:${vid}`)
    if (redisData !== null && redisData !== undefined) {
      const parsed = JSON.parse(redisData)
      if (typeof parsed !== 'number') {
        await delKv(`galzy:game:download:${vid}`)
      } else {
        return parsed as number
      }
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
    void setKv(
      `galzy:game:download:${vid}`,
      JSON.stringify(totalDownloads),
      60 * 15,
    )
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
