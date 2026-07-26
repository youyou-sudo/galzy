import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'
import { eventViews } from '../src/db/schema/services'
import * as schema from '../src/db/schema'

const UMAMI_URL = process.env.UMAMI_LOCAL_URL!
const UMAMI_USER = process.env.UMAMI_DATA_USER!
const UMAMI_PASS = process.env.UMAMI_DATA_PASSWORD!
const UMAMI_SITE_ID = process.env.UMAMI_DATA_WEBSITE_ID!

const dbUrl = process.env.DATABASE_URL!
const client = new SQL(dbUrl)
const db = drizzle({ client, schema })

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff + 7)
  end.setHours(0, 0, 0, 0)
  return { startAt: start.getTime(), endAt: end.getTime() }
}

function spreadTimestamps(count: number, startAt: number, endAt: number): Date[] {
  const range = endAt - startAt
  const dates: Date[] = []
  for (let i = 0; i < count; i++) {
    const offset = Math.floor((i / count) * range)
    dates.push(new Date(startAt + offset))
  }
  return dates
}

async function getUmamiToken(): Promise<string> {
  const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UMAMI_USER, password: UMAMI_PASS }),
  })
  const data = await res.json()
  return data.token
}

async function fetchUmamiEventValues(
  token: string,
  eventName: string,
  propertyName: string,
  startAt: number,
  endAt: number,
): Promise<Array<{ value: string; total: number }>> {
  const url = `${UMAMI_URL}/api/websites/${UMAMI_SITE_ID}/event-data/values?startAt=${startAt}&endAt=${endAt}&unit=day&timezone=Asia/Shanghai&page=1&eventName=${eventName}&propertyName=${propertyName}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}

async function seedGameViews(token: string, startAt: number, endAt: number) {
  console.log('[Seed] Fetching GameViews from Umami...')
  const events = await fetchUmamiEventValues(token, 'GameViews', 'idtitlee', startAt, endAt)
  console.log(`[Seed] Got ${events.length} game events`)

  const values: Array<{ eventType: string; targetId: string; createdAt: Date }> = []
  for (const event of events) {
    const timestamps = spreadTimestamps(event.total, startAt, endAt)
    for (const ts of timestamps) {
      values.push({ eventType: 'game_view', targetId: event.value, createdAt: ts })
    }
  }

  if (values.length > 0) {
    await db.insert(eventViews).values(values)
    console.log(`[Seed] Inserted ${values.length} game view records`)
  }
}

async function seedTagViews(token: string, startAt: number, endAt: number) {
  console.log('[Seed] Fetching TagViews from Umami...')
  const events = await fetchUmamiEventValues(token, 'TagViews', 'tagtitle', startAt, endAt)
  console.log(`[Seed] Got ${events.length} tag events`)

  const values: Array<{ eventType: string; targetId: string; createdAt: Date }> = []
  for (const event of events) {
    const match = event.value.match(/^\[tag:(.*?)\]-\[(.*)\]$/)
    const tagId = match?.[1] ?? event.value
    const timestamps = spreadTimestamps(event.total, startAt, endAt)
    for (const ts of timestamps) {
      values.push({ eventType: 'tag_view', targetId: tagId, createdAt: ts })
    }
  }

  if (values.length > 0) {
    // Insert in batches of 1000
    for (let i = 0; i < values.length; i += 1000) {
      const batch = values.slice(i, i + 1000)
      await db.insert(eventViews).values(batch)
    }
    console.log(`[Seed] Inserted ${values.length} tag view records`)
  }
}

async function main() {
  console.log('[Seed] Starting Umami data migration...')
  const { startAt, endAt } = getWeekRange()
  console.log(`[Seed] Week range: ${new Date(startAt).toISOString()} - ${new Date(endAt).toISOString()}`)

  const token = await getUmamiToken()
  console.log('[Seed] Got Umami token')

  await seedGameViews(token, startAt, endAt)
  await seedTagViews(token, startAt, endAt)

  console.log('[Seed] Done! Umami data migrated to galrc_event_views')
  process.exit(0)
}

main().catch((err) => {
  console.error('[Seed] Failed:', err)
  process.exit(1)
})
