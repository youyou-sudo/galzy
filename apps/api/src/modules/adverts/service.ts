import { adSlots, adverts, db } from '@api/libs'
import { delKv, getKv, setKv } from '@api/libs/redis'
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { status } from 'elysia'
import type { AdvertModel } from './model'

/** 素材的设备定向（all = 桌面与手机都展示）。 */
export type AdvertDevice = 'all' | 'desktop' | 'mobile'
/** 广告位的手机端展示方式。 */
export type AdMobileMode = 'carousel' | 'stack' | 'hidden'
/** 由 enabled + 排期推导的投放状态（后台展示用）。 */
export type AdvertStatus = 'running' | 'scheduled' | 'expired' | 'paused'

/** service 返回给 HTTP 层的形状（时间统一为 ISO 字符串）。 */
export type AdSlotDTO = {
  id: number
  key: string
  name: string
  description: string | null
  maxItems: number
  mobileMode: AdMobileMode
  carouselInterval: number
  enabled: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type AdSlotWithCountDTO = AdSlotDTO & { advertCount: number }

export type AdvertDTO = {
  id: number
  slotId: number
  name: string
  image: string
  href: string
  description: string | null
  enabled: boolean
  device: AdvertDevice
  weight: number
  startAt: string | null
  endAt: string | null
  sortOrder: number
  impressions: number
  clicks: number
  status: AdvertStatus
  createdAt: string | null
  updatedAt: string | null
}

/** 公开接口返回的最小素材字段（不含后台备注与统计）。 */
export type PublicAdvertDTO = {
  id: number
  name: string
  image: string
  href: string
  device: AdvertDevice
}

/** GET /adverts/slot/:key 的返回：已按设备定向 + 权重抽好样。 */
export type AdSlotPayloadDTO = {
  slot: {
    key: string
    name: string
    maxItems: number
    mobileMode: AdMobileMode
    carouselInterval: number
  }
  desktop: PublicAdvertDTO[]
  mobile: PublicAdvertDTO[]
}

type AdSlotRow = typeof adSlots.$inferSelect
type AdvertRow = typeof adverts.$inferSelect

/** 缓存内容：广告位配置 + 该位「在投」素材（已按 sort_order 排序，未做设备过滤）。 */
type SlotCachePayload = { slot: AdSlotDTO; ads: AdvertDTO[] }

/**
 * 公开数据缓存键前缀。
 *
 * 写操作（广告位/素材的增删改、拖动排序）成功后精确失效「受影响广告位」的 key，
 * 否则后台停用一张横幅，前台最长还要再展示 60 秒。
 * track（曝光/点击）只改计数，不影响公开数据，不失效缓存。
 */
const SLOT_CACHE_PREFIX = 'galzy:adverts:slot:'
const SLOT_CACHE_TTL = 60

const slotCacheKey = (key: string) => `${SLOT_CACHE_PREFIX}${key}`

/**
 * 排序号的串行化闸门（按广告位分锁）。
 *
 * 「读 max(sort_order) → 插入」与「整位重排」都必须互斥，否则并发新增会拿到
 * 同一个 sortOrder，两个后台同时拖动会互相覆盖。按 slotId 分锁让不同广告位
 * 的写操作互不阻塞。advisory lock 是事务级的，提交/回滚自动释放。
 */
const SORT_LOCK_KEY = 'galzy:adverts:sort-order'

async function lockSlotSortOrder(
  trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  slotId: number,
): Promise<void> {
  await trx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${SORT_LOCK_KEY + ':' + slotId}))`,
  )
}

/**
 * 写操作成功后失效「受影响广告位」的缓存（1~2 个 key）。
 *
 * 这里刻意不用 delKvPattern（SCAN 遍历整个 keyspace）：共享 Redis 上可能有上万
 * 个 key，跨机房 RTT 250ms 时单次 SCAN 全库要几十秒，而一次后台写只影响一两个
 * 广告位。精确 DEL 后行为不变——后台改完，下一次读取立刻拿到新数据。
 *
 * 失效失败只告警：缓存最多再脏 60s（TTL 到期自愈），不能因此回滚已提交的业务。
 */
async function invalidateSlotCache(keys: string[]): Promise<void> {
  const unique = [...new Set(keys)]
  if (unique.length === 0) return
  await Promise.all(
    unique.map((key) =>
      delKv(slotCacheKey(key)).catch((e) => {
        console.warn(
          `[adverts] 广告位缓存失效失败: ${slotCacheKey(key)}`,
          e instanceof Error ? e.message : String(e),
        )
      }),
    ),
  )
}

/** 按广告位 id 查 key（查库 1 次，一般返回 1 条）。 */
async function slotKeysOf(slotIds: number[]): Promise<string[]> {
  const unique = [...new Set(slotIds)]
  if (unique.length === 0) return []
  const rows = await db
    .select({ key: adSlots.key })
    .from(adSlots)
    .where(inArray(adSlots.id, unique))
  return rows.map((row) => row.key)
}

function toSlotDTO(row: AdSlotRow): AdSlotDTO {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    maxItems: row.maxItems,
    mobileMode: row.mobileMode as AdMobileMode,
    carouselInterval: row.carouselInterval,
    enabled: row.enabled,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}

/** 由 enabled + 排期推导投放状态：停用优先，其次未开始/已结束，否则投放中。 */
function deriveStatus(row: AdvertRow, now: Date): AdvertStatus {
  if (!row.enabled) return 'paused'
  if (row.startAt && now.getTime() < row.startAt.getTime()) return 'scheduled'
  if (row.endAt && now.getTime() > row.endAt.getTime()) return 'expired'
  return 'running'
}

function toAdvertDTO(row: AdvertRow, now: Date): AdvertDTO {
  return {
    id: row.id,
    slotId: row.slotId,
    name: row.name,
    image: row.image,
    href: row.href,
    description: row.description ?? null,
    enabled: row.enabled,
    device: row.device as AdvertDevice,
    weight: row.weight,
    startAt: row.startAt ? row.startAt.toISOString() : null,
    endAt: row.endAt ? row.endAt.toISOString() : null,
    sortOrder: row.sortOrder,
    impressions: row.impressions,
    clicks: row.clicks,
    status: deriveStatus(row, now),
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}

function toPublicAdvert(ad: AdvertDTO): PublicAdvertDTO {
  return {
    id: ad.id,
    name: ad.name,
    image: ad.image,
    href: ad.href,
    device: ad.device,
  }
}

/**
 * 空字符串归一化为 NULL：后台表单清空可选字段后提交的是 ''，
 * 直接入库会让「有值」与「没值」两种语义混在一起（前端也难判断）。
 */
function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

/** 必填文本：先 trim 再判空，避免 '   ' 通过校验后落库成空白横幅。 */
function requiredText(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw status(400, `${label}不能为空喵～`)
  return trimmed
}

/**
 * 排期时间解析：
 * - undefined = 不修改（update 语义）；
 * - null / '' = 清空排期（落库 NULL）；
 * - 其余按 ISO 字符串解析，非法直接 400（不要让它变成 Invalid Date 落库）。
 */
function parseDateTime(
  value: string | null | undefined,
  label: string,
): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    throw status(400, `${label}格式不正确喵～`)
  }
  return date
}

/** 排期先后：两端都有值时，开始必须早于结束（相等也算配置错误）。 */
function assertScheduleOrder(startAt: Date | null, endAt: Date | null): void {
  if (startAt && endAt && startAt.getTime() >= endAt.getTime()) {
    throw status(400, '开始时间必须早于结束时间喵～')
  }
}

/**
 * 唯一键冲突判定。
 *
 * drizzle 会把驱动错误包成 DrizzleQueryError（顶层没有 PG 错误码），
 * 真正的 PostgresError（errno = '23505'）在 `cause` 链上，所以要逐层找。
 */
function isUniqueViolation(e: unknown): boolean {
  let current: unknown = e
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current !== 'object' && typeof current !== 'function')
      return false
    const err = current as { errno?: unknown; code?: unknown; cause?: unknown }
    if (err.errno === '23505' || err.code === '23505') return true
    current = err.cause
  }
  return false
}

/**
 * 权重不放回随机抽取：候选多于 maxItems 时使用。
 *
 * - 权重 0 的候选在随机轮换里永远抽不到（产品语义：这一轮先不上）；
 * - 若剩余候选权重全为 0（或负数，防御历史脏数据），退化为等概率抽取：
 *   宁可展示「权重设为 0 的素材」，也不要让广告位出现空位；
 * - 抽完由调用方按 (sort_order, id) 重新排序，保证展示顺序稳定。
 */
function weightedSample(rows: AdvertDTO[], count: number): AdvertDTO[] {
  const pool = [...rows]
  const picked: AdvertDTO[] = []
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, row) => sum + Math.max(0, row.weight), 0)
    if (total <= 0) {
      const index = Math.floor(Math.random() * pool.length)
      picked.push(pool.splice(index, 1)[0])
      continue
    }
    let ticket = Math.random() * total
    let index = 0
    for (; index < pool.length; index++) {
      ticket -= Math.max(0, pool[index].weight)
      if (ticket < 0) break
    }
    if (index >= pool.length) index = pool.length - 1
    picked.push(pool.splice(index, 1)[0])
  }
  return picked
}

function bySortOrder(a: AdvertDTO, b: AdvertDTO): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.id - b.id
}

/**
 * 按设备过滤 + 抽样：候选不超过 maxItems 时按 sort_order 全展示，
 * 超过时按权重不放回抽取 maxItems 条，再按 sort_order 排回稳定顺序。
 */
function pickForDevice(
  ads: AdvertDTO[],
  devices: AdvertDevice[],
  maxItems: number,
): PublicAdvertDTO[] {
  const candidates = ads
    .filter((ad) => devices.includes(ad.device))
    .sort(bySortOrder)
  const chosen =
    candidates.length <= maxItems
      ? candidates
      : weightedSample(candidates, maxItems).sort(bySortOrder)
  return chosen.map(toPublicAdvert)
}

/**
 * 读缓存。内容损坏（历史格式 / 手工写入）时按未命中处理并删键，
 * 不要让一个坏 JSON 把整个广告位打成 500。
 */
async function readSlotCache(key: string): Promise<SlotCachePayload | null> {
  const cached = await getKv(slotCacheKey(key))
  if (!cached) return null
  try {
    return JSON.parse(cached) as SlotCachePayload
  } catch {
    await delKv(slotCacheKey(key)).catch(() => {})
    return null
  }
}

/** 在投过滤：enabled=true 且已开始 且未结束。 */
function liveWhereClause(slotId: number, now: Date) {
  return and(
    eq(adverts.slotId, slotId),
    eq(adverts.enabled, true),
    or(isNull(adverts.startAt), lte(adverts.startAt, now)),
    or(isNull(adverts.endAt), gte(adverts.endAt, now)),
  )
}

export const AdvertService = {
  /**
   * 公开：按 key 取广告位投放数据。
   *
   * 返回值：广告位不存在或 enabled=false → null（前台据此隐藏整个区块）；
   * 否则 { slot, desktop, mobile }，两个列表各自已做设备定向 + 权重抽样。
   * 缓存 60s，写操作主动失效；track 不影响缓存。
   */
  async getSlot(key: string): Promise<AdSlotPayloadDTO | null> {
    const cached = await readSlotCache(key)
    if (cached) return buildPayload(cached.slot, cached.ads)

    const [slotRow] = await db
      .select()
      .from(adSlots)
      .where(eq(adSlots.key, key))
      .limit(1)
    // 不缓存 null：广告位刚建/刚启用时要立刻生效，缓存空结果反而要等 60s
    if (!slotRow?.enabled) return null

    const now = new Date()
    const rows = await db
      .select()
      .from(adverts)
      .where(liveWhereClause(slotRow.id, now))
      .orderBy(asc(adverts.sortOrder), asc(adverts.id))

    const slot = toSlotDTO(slotRow)
    const ads = rows.map((row) => toAdvertDTO(row, now))

    // Redis 不可用时 safeRedisOp 已吞掉错误（返回 undefined），这里只兜底日志
    try {
      await setKv(
        slotCacheKey(key),
        JSON.stringify({ slot, ads } satisfies SlotCachePayload),
        SLOT_CACHE_TTL,
      )
    } catch (e) {
      console.warn(
        `[adverts] 广告位缓存写入失败: ${slotCacheKey(key)}`,
        e instanceof Error ? e.message : String(e),
      )
    }

    return buildPayload(slot, ads)
  },

  /** 曝光 / 点击：直接自增，不检查存在性、不报错、不失效缓存。 */
  async track({ id, type }: AdvertModel.track): Promise<{ success: true }> {
    if (type === 'impression') {
      await db
        .update(adverts)
        .set({ impressions: sql`${adverts.impressions} + 1` })
        .where(eq(adverts.id, id))
    } else {
      await db
        .update(adverts)
        .set({ clicks: sql`${adverts.clicks} + 1` })
        .where(eq(adverts.id, id))
    }
    return { success: true }
  },

  /** 管理：广告位列表（附带素材总数，删除前提示用），按 id 排序。 */
  async listSlots(): Promise<AdSlotWithCountDTO[]> {
    const [rows, counts] = await Promise.all([
      db.select().from(adSlots).orderBy(asc(adSlots.id)),
      db
        .select({
          slotId: adverts.slotId,
          count: sql<number>`count(*)::int`,
        })
        .from(adverts)
        .groupBy(adverts.slotId),
    ])
    const countBySlot = new Map(
      counts.map((row) => [row.slotId, Number(row.count)]),
    )
    return rows.map((row) => ({
      ...toSlotDTO(row),
      advertCount: countBySlot.get(row.id) ?? 0,
    }))
  },

  /** 管理：新建广告位；key 冲突返回 409（唯一索引是最终防线）。 */
  async createSlot(data: AdvertModel.slotCreate): Promise<AdSlotDTO> {
    const name = requiredText(data.name, '广告位名称')
    const key = data.key.trim()
    try {
      const [inserted] = await db
        .insert(adSlots)
        .values({
          key,
          name,
          description: emptyToNull(data.description),
          ...(data.maxItems !== undefined && { maxItems: data.maxItems }),
          ...(data.mobileMode !== undefined && { mobileMode: data.mobileMode }),
          ...(data.carouselInterval !== undefined && {
            carouselInterval: data.carouselInterval,
          }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
        })
        .returning()
      await invalidateSlotCache([inserted.key])
      return toSlotDTO(inserted)
    } catch (e) {
      if (isUniqueViolation(e)) throw status(409, '广告位标识已存在喵～')
      throw e
    }
  },

  /** 管理：部分更新广告位（undefined = 保持原值）。 */
  async updateSlot(
    id: number,
    data: AdvertModel.slotUpdate,
  ): Promise<AdSlotDTO> {
    // 空 patch 会让 drizzle 抛 "No values to set"（500），提前转成 400
    if (Object.keys(data).length === 0) {
      throw status(400, '没有需要更新的字段喵～')
    }
    const patch = {
      ...(data.key !== undefined && { key: data.key.trim() }),
      ...(data.name !== undefined && {
        name: requiredText(data.name, '广告位名称'),
      }),
      ...(data.description !== undefined && {
        description: emptyToNull(data.description),
      }),
      ...(data.maxItems !== undefined && { maxItems: data.maxItems }),
      ...(data.mobileMode !== undefined && { mobileMode: data.mobileMode }),
      ...(data.carouselInterval !== undefined && {
        carouselInterval: data.carouselInterval,
      }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      // updated_at 只有 defaultNow()、没有 ON UPDATE 触发器，这里显式刷新
      updatedAt: new Date(),
    }
    // 先读旧 key：改了 key 时旧缓存也要删，否则旧 key 还读得到旧配置
    const [existing] = await db
      .select({ id: adSlots.id, key: adSlots.key })
      .from(adSlots)
      .where(eq(adSlots.id, id))
      .limit(1)
    if (!existing) throw status(404, '广告位不存在喵～')

    let updated: AdSlotRow
    try {
      const [row] = await db
        .update(adSlots)
        .set(patch)
        .where(eq(adSlots.id, id))
        .returning()
      // 并发删除（极少见）：读到了旧行、更新时已不在
      if (!row) throw status(404, '广告位不存在喵～')
      updated = row
    } catch (e) {
      if (isUniqueViolation(e)) throw status(409, '广告位标识已存在喵～')
      throw e
    }

    await invalidateSlotCache([existing.key, updated.key])
    return toSlotDTO(updated)
  },

  /** 管理：删除广告位；该位下还有素材时 400（不静默级联删素材）。 */
  async deleteSlot(id: number): Promise<{ success: true }> {
    // 先读 key：删除后就查不到了，而缓存要按 key 精确失效
    const [existing] = await db
      .select({ key: adSlots.key })
      .from(adSlots)
      .where(eq(adSlots.id, id))
      .limit(1)
    if (!existing) throw status(404, '广告位不存在喵～')

    const deleted = await db.transaction(async (trx) => {
      const [{ count = 0 } = { count: 0 }] = await trx
        .select({ count: sql<number>`count(*)::int` })
        .from(adverts)
        .where(eq(adverts.slotId, id))
      if (Number(count) > 0) {
        throw status(400, '请先删除该广告位下的广告喵～')
      }
      return trx.delete(adSlots).where(eq(adSlots.id, id)).returning({
        id: adSlots.id,
      })
    })
    if (deleted.length === 0) throw status(404, '广告位不存在喵～')
    await invalidateSlotCache([existing.key])
    return { success: true }
  },

  /** 管理：全部素材（含停用/未开始/已结束），可按广告位筛选。 */
  async listAll(slotId?: number): Promise<AdvertDTO[]> {
    const now = new Date()
    const base = db.select().from(adverts)
    const rows = slotId
      ? await base
          .where(eq(adverts.slotId, slotId))
          .orderBy(asc(adverts.slotId), asc(adverts.sortOrder), asc(adverts.id))
      : await base.orderBy(
          asc(adverts.slotId),
          asc(adverts.sortOrder),
          asc(adverts.id),
        )
    return rows.map((row) => toAdvertDTO(row, now))
  },

  /**
   * 管理：新增素材，sortOrder 排到该广告位末尾（max + 1，空位为 0）。
   * 排序号读取与插入在同一个事务里、按广告位持有 advisory lock 串行化。
   */
  async create(data: AdvertModel.create): Promise<AdvertDTO> {
    const name = requiredText(data.name, '名称')
    const image = requiredText(data.image, '图片地址')
    const href = requiredText(data.href, '跳转链接')
    const startAt = parseDateTime(data.startAt, '开始时间') ?? null
    const endAt = parseDateTime(data.endAt, '结束时间') ?? null
    assertScheduleOrder(startAt, endAt)

    const [slotRow] = await db
      .select({ id: adSlots.id, key: adSlots.key })
      .from(adSlots)
      .where(eq(adSlots.id, data.slotId))
      .limit(1)
    if (!slotRow) throw status(404, '广告位不存在喵～')

    const created = await db.transaction(async (trx) => {
      await lockSlotSortOrder(trx, data.slotId)

      const [row] = await trx
        .select({ max: sql<number | null>`max(${adverts.sortOrder})` })
        .from(adverts)
        .where(eq(adverts.slotId, data.slotId))
      const sortOrder =
        row?.max === null || row?.max === undefined ? 0 : Number(row.max) + 1

      const [inserted] = await trx
        .insert(adverts)
        .values({
          slotId: data.slotId,
          name,
          image,
          href,
          description: emptyToNull(data.description),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          ...(data.device !== undefined && { device: data.device }),
          ...(data.weight !== undefined && { weight: data.weight }),
          startAt,
          endAt,
          sortOrder,
        })
        .returning()
      return inserted
    })

    await invalidateSlotCache([slotRow.key])
    return toAdvertDTO(created, new Date())
  },

  /**
   * 管理：部分更新素材。
   *
   * 排期可以只改一侧：此时要和「现有的另一侧」比较先后，
   * 否则 PUT { startAt: 明天 } 能把一条 endAt 是今天的素材改成永远不展示的非法区间。
   * startAt/endAt 传 null 表示清空排期。
   */
  async update(id: number, data: AdvertModel.update): Promise<AdvertDTO> {
    if (Object.keys(data).length === 0) {
      throw status(400, '没有需要更新的字段喵～')
    }

    const [existing] = await db
      .select()
      .from(adverts)
      .where(eq(adverts.id, id))
      .limit(1)
    if (!existing) throw status(404, '广告不存在喵～')

    const startAt = parseDateTime(data.startAt, '开始时间')
    const endAt = parseDateTime(data.endAt, '结束时间')
    assertScheduleOrder(
      startAt === undefined ? existing.startAt : startAt,
      endAt === undefined ? existing.endAt : endAt,
    )

    const patch = {
      ...(data.name !== undefined && { name: requiredText(data.name, '名称') }),
      ...(data.image !== undefined && {
        image: requiredText(data.image, '图片地址'),
      }),
      ...(data.href !== undefined && {
        href: requiredText(data.href, '跳转链接'),
      }),
      ...(data.description !== undefined && {
        description: emptyToNull(data.description),
      }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.device !== undefined && { device: data.device }),
      ...(data.weight !== undefined && { weight: data.weight }),
      ...(startAt !== undefined && { startAt }),
      ...(endAt !== undefined && { endAt }),
      updatedAt: new Date(),
    }

    const [updated] = await db
      .update(adverts)
      .set(patch)
      .where(eq(adverts.id, id))
      .returning()
    if (!updated) throw status(404, '广告不存在喵～')

    await invalidateSlotCache(await slotKeysOf([existing.slotId]))
    return toAdvertDTO(updated, new Date())
  },

  async delete(id: number): Promise<{ success: true }> {
    // returning slotId：删除后还要按它精确失效缓存，避免多一次 SELECT
    const deleted = await db
      .delete(adverts)
      .where(eq(adverts.id, id))
      .returning({ id: adverts.id, slotId: adverts.slotId })
    if (deleted.length === 0) throw status(404, '广告不存在喵～')

    await invalidateSlotCache(
      await slotKeysOf(deleted.map((row) => row.slotId)),
    )
    return { success: true }
  },

  /**
   * 管理：拖动排序（按广告位）。数组下标即新的 sortOrder。
   *
   * - 先校验「提交的 id 集合 == 该广告位现有 id 集合」：少传会让未提交的行保留旧序号、
   *   与新序号 0..n-1 重叠，前台顺序错乱；
   * - 更新按 id 升序执行，两个后台同时拖动时加锁顺序一致，不会死锁。
   */
  async reorder({
    slotId,
    ids,
  }: AdvertModel.reorder): Promise<{ success: true }> {
    const unique = new Set(ids)
    if (unique.size !== ids.length) {
      throw status(400, '排序列表里有重复 id 喵～')
    }

    await db.transaction(async (trx) => {
      await lockSlotSortOrder(trx, slotId)

      const rows = await trx
        .select({ id: adverts.id })
        .from(adverts)
        .where(eq(adverts.slotId, slotId))
      const existing = new Set(rows.map((row) => row.id))
      const matches =
        existing.size === unique.size &&
        [...unique].every((id) => existing.has(id))
      if (!matches) {
        throw status(400, '排序列表与该广告位下的广告不匹配，请刷新后重试喵～')
      }

      const ordered = ids
        .map((id, index) => ({ id, index }))
        .sort((a, b) => a.id - b.id)
      for (const { id, index } of ordered) {
        await trx
          .update(adverts)
          .set({ sortOrder: index })
          .where(eq(adverts.id, id))
      }
    })

    await invalidateSlotCache(await slotKeysOf([slotId]))
    return { success: true }
  },
}

/**
 * 组装公开返回：设备定向 + 权重抽样。
 *
 * 缓存里存的是「在投素材全集」（不按设备切分），因为同一份数据要服务
 * 桌面与手机两种请求；抽样是每次请求现做的，所以缓存 60s 也不会让
 * 权重轮换停止（每次命中也重新抽）。
 */
function buildPayload(slot: AdSlotDTO, ads: AdvertDTO[]): AdSlotPayloadDTO {
  return {
    slot: {
      key: slot.key,
      name: slot.name,
      maxItems: slot.maxItems,
      mobileMode: slot.mobileMode,
      carouselInterval: slot.carouselInterval,
    },
    desktop: pickForDevice(ads, ['all', 'desktop'], slot.maxItems),
    mobile: pickForDevice(ads, ['all', 'mobile'], slot.maxItems),
  }
}
