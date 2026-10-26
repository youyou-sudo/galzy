import { betterAuth } from '@api/modules/auth'
import { Elysia, status } from 'elysia'
import { FriendLinkModel } from './model'
import { FriendLinkService } from './service'

/** 路径参数是字符串；非法 id 直接 400，别让 NaN 流进 SQL 变成空结果。 */
function parseId(id: string): number {
  const value = Number(id)
  if (!Number.isInteger(value) || value <= 0)
    throw status(400, '无效的友情链接 ID 喵～')
  return value
}

export const friendLinks = new Elysia({ prefix: '/friend-links' })
  .use(betterAuth)
  // 公开：前台友情链接列表
  .get('/', async () => {
    return await FriendLinkService.list()
  })
  // 管理：新增
  .post(
    '/',
    async ({ body }) => {
      return await FriendLinkService.create(body)
    },
    { isAdmin: true, body: FriendLinkModel.Create },
  )
  // 管理：拖动排序（必须注册在 '/:id' 之前，否则 reorder 会被当成 id 匹配）
  .put(
    '/reorder',
    async ({ body }) => {
      return await FriendLinkService.reorder(body.ids)
    },
    { isAdmin: true, body: FriendLinkModel.Reorder },
  )
  // 管理：更新
  .put(
    '/:id',
    async ({ params, body }) => {
      return await FriendLinkService.update(parseId(params.id), body)
    },
    {
      isAdmin: true,
      params: FriendLinkModel.Params,
      body: FriendLinkModel.Update,
    },
  )
  // 管理：删除
  .delete(
    '/:id',
    async ({ params }) => {
      return await FriendLinkService.delete(parseId(params.id))
    },
    { isAdmin: true, params: FriendLinkModel.Params },
  )
