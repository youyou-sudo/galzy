import { betterAuth } from '@api/modules/auth'
import { Elysia, status } from 'elysia'
import { AdvertModel } from './model'
import { AdvertService } from './service'

/** 路径参数是字符串；非法 id 直接 400，别让 NaN 流进 SQL 变成空结果。 */
function parseId(id: string): number {
  const value = Number(id)
  if (!Number.isInteger(value) || value <= 0)
    throw status(400, '无效的 ID 喵～')
  return value
}

/** GET /adverts/all?slotId= 的 query 是字符串；非法值 400，而不是悄悄返回全部。 */
function parseOptionalId(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw status(400, '无效的广告位 ID 喵～')
  return parsed
}

export const adverts = new Elysia({ prefix: '/adverts' })
  .use(betterAuth)
  // ── 公开 ────────────────────────────────────────────────────
  // 前台按广告位 key 取投放数据（在投过滤 + 设备定向 + 权重抽样，Redis 缓存 60s）
  .get(
    '/slot/:key',
    async ({ params }) => {
      return await AdvertService.getSlot(params.key)
    },
    {
      params: AdvertModel.SlotParams,
      // Elysia 对 null 的默认序列化是「200 + 空 body」，Eden 会拿到空字符串而
      // 不是 null。契约要求这里返回 JSON null（前端用 payload === null / ?? null
      // 判断），所以显式写一个 JSON 的 null 体。
      mapResponse({ response }) {
        if (response === null) {
          return new Response('null', {
            headers: { 'content-type': 'application/json;charset=utf-8' },
          })
        }
      },
    },
  )
  // 曝光 / 点击上报：直接自增计数，未知 id 也返回 success（不暴露存在性）
  .post(
    '/track',
    async ({ body }) => {
      return await AdvertService.track(body)
    },
    { body: AdvertModel.Track },
  )
  // ── 管理：广告位 ────────────────────────────────────────────
  .get(
    '/slots',
    async () => {
      return await AdvertService.listSlots()
    },
    { isAdmin: true },
  )
  .post(
    '/slots',
    async ({ body }) => {
      return await AdvertService.createSlot(body)
    },
    { isAdmin: true, body: AdvertModel.SlotCreate },
  )
  .put(
    '/slots/:id',
    async ({ params, body }) => {
      return await AdvertService.updateSlot(parseId(params.id), body)
    },
    {
      isAdmin: true,
      params: AdvertModel.Params,
      body: AdvertModel.SlotUpdate,
    },
  )
  .delete(
    '/slots/:id',
    async ({ params }) => {
      return await AdvertService.deleteSlot(parseId(params.id))
    },
    { isAdmin: true, params: AdvertModel.Params },
  )
  // ── 管理：素材 ──────────────────────────────────────────────
  // 全部素材（含停用/未开始/已结束），不走缓存
  .get(
    '/all',
    async ({ query }) => {
      return await AdvertService.listAll(parseOptionalId(query.slotId))
    },
    { isAdmin: true, query: AdvertModel.ListQuery },
  )
  .post(
    '/',
    async ({ body }) => {
      return await AdvertService.create(body)
    },
    { isAdmin: true, body: AdvertModel.Create },
  )
  // 拖动排序（必须注册在 '/:id' 之前，否则 reorder 会被当成 id 匹配）
  .put(
    '/reorder',
    async ({ body }) => {
      return await AdvertService.reorder(body)
    },
    { isAdmin: true, body: AdvertModel.Reorder },
  )
  .put(
    '/:id',
    async ({ params, body }) => {
      return await AdvertService.update(parseId(params.id), body)
    },
    {
      isAdmin: true,
      params: AdvertModel.Params,
      body: AdvertModel.Update,
    },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      return await AdvertService.delete(parseId(params.id))
    },
    { isAdmin: true, params: AdvertModel.Params },
  )
