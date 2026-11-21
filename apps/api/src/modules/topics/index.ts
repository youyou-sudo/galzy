import { betterAuth } from '@api/modules/auth'
import { auth } from '@api/modules/auth/service'
import { Elysia, status } from 'elysia'
import { TopicModel } from './model'
import { TopicService, topicViewerOf } from './service'

export const topics = new Elysia({ prefix: '/topics' })
  .use(betterAuth)
  .get(
    '/',
    async ({ query, request }) => {
      // 草稿/隐藏/已删除等非公开状态只有管理员能列表查看：否则任何人都能
      // 靠 status 参数把别人删掉的帖子翻出来。
      if ((query?.status ?? 'published') !== 'published') {
        const session = await auth.api.getSession({ headers: request.headers })
        if (session?.user?.role !== 'admin') {
          throw status(403, '无权查看未发布的帖子')
        }
      }
      return await TopicService.getTopics(query, query?.userId)
    },
    {
      query: TopicModel.List,
    },
  )
  .get(
    '/favorites',
    async ({ query, user }) => {
      return await TopicService.getFavorites(query, user.id)
    },
    {
      auth: true,
      query: TopicModel.FavoritesList,
    },
  )
  .get(
    '/likes',
    async ({ query, user }) => {
      return await TopicService.getLikes(query, user.id)
    },
    {
      auth: true,
      query: TopicModel.LikesList,
    },
  )
  .get(
    '/:id',
    async ({ params, request }) => {
      // 访问控制只认服务端会话：未发布/已删除的帖子仅归属者与管理员可见，
      // 客户端传进来的 userId 不能作为身份依据。
      const session = await auth.api.getSession({ headers: request.headers })
      return await TopicService.getTopic(params, topicViewerOf(session))
    },
    {
      params: TopicModel.Params,
    },
  )
  .post(
    '/',
    async ({ body, user }) => {
      return await TopicService.createTopic(body, user.id)
    },
    {
      auth: true,
      body: TopicModel.Create,
    },
  )
  .put(
    '/:id',
    async ({ params: { id }, body, user }) => {
      return await TopicService.updateTopic({ id, ...body }, user.id, user.role)
    },
    {
      auth: true,
      params: TopicModel.Params,
      body: TopicModel.Update,
    },
  )
  .delete(
    '/:id',
    async ({ params, user }) => {
      return await TopicService.deleteTopic(params, user.id, user.role)
    },
    {
      auth: true,
      params: TopicModel.Params,
    },
  )
  .post(
    '/:id/like',
    async ({ params, user }) => {
      return await TopicService.toggleLike(params, user.id)
    },
    {
      auth: true,
      params: TopicModel.Params,
      body: TopicModel.LikeToggle,
    },
  )
  .post(
    '/:id/favorite',
    async ({ params, user }) => {
      return await TopicService.toggleFavorite(params, user.id)
    },
    {
      auth: true,
      params: TopicModel.Params,
      body: TopicModel.LikeToggle,
    },
  )
