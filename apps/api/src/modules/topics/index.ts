import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { TopicModel } from './model'
import { TopicService } from './service'

export const topics = new Elysia({ prefix: '/topics' })
  .use(betterAuth)
  .get(
    '/',
    async ({ query }) => {
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
    async ({ params, query }) => {
      return await TopicService.getTopic(params, query?.userId)
    },
    {
      params: TopicModel.Params,
      query: TopicModel.LikeStatus,
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
