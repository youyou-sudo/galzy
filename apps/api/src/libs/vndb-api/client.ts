import type { VndbQuery, VndbResponse } from './types'

const BASE = 'https://api.vndb.org/kana'

class RateLimiter {
  private tokens = 200
  private lastRefill = Date.now()

  async acquire(): Promise<void> {
    const now = Date.now()
    this.tokens = Math.min(
      200,
      this.tokens + ((now - this.lastRefill) / 300_000) * 200,
    )
    this.lastRefill = now
    if (this.tokens < 1) {
      await new Promise((r) => setTimeout(r, 60_000))
      return this.acquire()
    }
    this.tokens--
  }
}

const limiter = new RateLimiter()

async function post<T>(
  endpoint: string,
  body: VndbQuery,
  retries = 3,
): Promise<VndbResponse<T>> {
  await limiter.acquire()
  console.log(`🌐 VNDB POST /${endpoint} page=${body.page || 1}`)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.VNDB_API_TOKEN
            ? { Authorization: `Token ${process.env.VNDB_API_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })

      if (res.status === 429) {
        console.log('⏳ VNDB rate limited, waiting 60s...')
        await new Promise((r) => setTimeout(r, 60_000))
        continue
      }

      if (!res.ok) {
        const text = await res.text()
        console.error(`❌ VNDB ${endpoint} ${res.status}: ${text}`)
        throw new Error(`VNDB ${endpoint} ${res.status}: ${text}`)
      }

      const json = (await res.json()) as VndbResponse<T>
      console.log(
        `✅ VNDB /${endpoint} → ${json.results.length} results, more=${json.more}`,
      )
      return json
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        console.error(
          `⏱️ VNDB ${endpoint} timeout (attempt ${attempt}/${retries})`,
        )
      } else if (attempt < retries) {
        console.error(
          `🔄 VNDB ${endpoint} retry ${attempt}/${retries}: ${err.message}`,
        )
        await new Promise((r) => setTimeout(r, 5_000))
      } else {
        throw err
      }
    }
  }

  throw new Error(`VNDB ${endpoint} failed after ${retries} retries`)
}

export function idOrFilter(ids: string[]): VndbQuery['filters'] {
  if (ids.length === 1) return ['id', '=', ids[0]]
  return ['or', ...ids.map((id) => ['id', '=', id] as [string, string, string])]
}

export async function* paginateAll<T>(
  endpoint: string,
  fields: string,
  filters: VndbQuery['filters'],
  pageSize = 100,
): AsyncGenerator<T[]> {
  let page = 1
  let more = true
  while (more) {
    const res = await post<T>(endpoint, {
      filters,
      fields,
      results: pageSize,
      page,
      sort: 'id',
    })
    yield res.results
    more = res.more
    page++
    if (more) await new Promise((r) => setTimeout(r, 2000))
  }
}

export const VndbClient = { post, idOrFilter, paginateAll }
