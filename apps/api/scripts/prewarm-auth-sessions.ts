/**
 * 把「已存在于 PostgreSQL 的登录会话」预热进 Redis（better-auth secondaryStorage）。
 *
 * 背景：`apps/api/src/modules/auth/service.ts` 给 better-auth 配了 Redis 二级存储，
 * 但 better-auth 只在**新建会话**（登录）时写 Redis；升级前就已存在的会话仍然
 * 每次回源数据库。线上库不在同机时，一次 session join user 查询可达 1.2s，
 * 表现为「登录用户每次开页面都慢一截」。
 *
 * 这个脚本按 better-auth 的存储格式（`<token> -> { session, user }`）把现有
 * 有效会话写进 Redis，并维护 `active-sessions-<userId>` 列表（会话列表接口用）。
 * 只写缓存、不改数据库；重复执行幂等。会话本身仍以数据库为准。
 *
 * 用法（apps/api 目录下，环境变量从 .env 读取）：
 *
 * ```bash
 * bun run scripts/prewarm-auth-sessions.ts            # 只统计，不写
 * bun run scripts/prewarm-auth-sessions.ts --apply    # 写入 Redis
 * ```
 */
import { SQL, RedisClient } from 'bun'

const APPLY = process.argv.includes('--apply')
const KEY_PREFIX = 'galzy:auth:'

const databaseUrl = process.env.DATABASE_URL
const redisUrl = process.env.REDIS_URL
if (!databaseUrl || !redisUrl) {
  console.error('[prewarm] DATABASE_URL / REDIS_URL 未配置，退出')
  process.exit(1)
}

const sql = new SQL(databaseUrl)
const redis = new RedisClient(redisUrl)

type SessionRow = {
  id: string
  token: string
  userId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  ipAddress: string | null
  userAgent: string | null
  impersonatedBy: string | null
}

type UserRow = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  createdAt: Date | null
  updatedAt: Date | null
}

const rows = (await sql`
  select
    s.id, s.token, s."userId", s."expiresAt", s."createdAt", s."updatedAt",
    s."ipAddress", s."userAgent", s."impersonatedBy",
    u.id as "uId", u.name as "uName", u.email as "uEmail",
    u."emailVerified" as "uEmailVerified", u.image as "uImage", u.role as "uRole",
    u.banned as "uBanned", u.ban_reason as "uBanReason", u.ban_expires as "uBanExpires",
    u."createdAt" as "uCreatedAt", u."updatedAt" as "uUpdatedAt"
  from galrc_session s
  join galrc_user u on u.id = s."userId"
  where s."expiresAt" > now()
  order by s."expiresAt" desc
`) as Array<Record<string, unknown>>

const now = Date.now()
const byUser = new Map<string, Array<{ token: string; expiresAt: number }>>()
let written = 0
let skipped = 0

for (const row of rows) {
  const session: SessionRow = {
    id: String(row.id),
    token: String(row.token),
    userId: String(row.userId),
    expiresAt: new Date(row.expiresAt as Date),
    createdAt: new Date(row.createdAt as Date),
    updatedAt: new Date(row.updatedAt as Date),
    ipAddress: (row.ipAddress as string | null) ?? null,
    userAgent: (row.userAgent as string | null) ?? null,
    impersonatedBy: (row.impersonatedBy as string | null) ?? null,
  }
  const user: UserRow = {
    id: String(row.uId),
    name: String(row.uName),
    email: String(row.uEmail),
    emailVerified: Boolean(row.uEmailVerified),
    image: (row.uImage as string | null) ?? null,
    role: (row.uRole as string | null) ?? null,
    banned: (row.uBanned as boolean | null) ?? null,
    banReason: (row.uBanReason as string | null) ?? null,
    banExpires: (row.uBanExpires as Date | null) ?? null,
    createdAt: (row.uCreatedAt as Date | null) ?? null,
    updatedAt: (row.uUpdatedAt as Date | null) ?? null,
  }

  const ttl = Math.floor((session.expiresAt.getTime() - now) / 1000)
  if (ttl <= 0) {
    skipped += 1
    continue
  }
  if (!APPLY) {
    written += 1
    continue
  }
  await redis.setex(
    `${KEY_PREFIX}${session.token}`,
    ttl,
    JSON.stringify({ session, user }),
  )
  const list = byUser.get(session.userId) ?? []
  list.push({ token: session.token, expiresAt: session.expiresAt.getTime() })
  byUser.set(session.userId, list)
  written += 1
}

if (APPLY) {
  for (const [userId, list] of byUser) {
    const sorted = [...list].sort((a, b) => a.expiresAt - b.expiresAt)
    const furthest = sorted.at(-1)?.expiresAt ?? now
    const ttl = Math.floor((furthest - now) / 1000)
    if (ttl > 0) {
      await redis.setex(
        `${KEY_PREFIX}active-sessions-${userId}`,
        ttl,
        JSON.stringify(sorted),
      )
    }
  }
}

console.log(
  `[prewarm] ${APPLY ? '已写入' : '可写入（dry-run）'} ${written} 个会话，` +
    `跳过 ${skipped} 个已过期，涉及 ${new Set(rows.map((r) => String(r.userId))).size} 个用户`,
)

await redis.close()
await sql.close()
