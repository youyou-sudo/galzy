import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { TopicModel } from './model'
import { TopicService } from './service'

export const topics = new Elysia({ prefix: '/topics' })
  .use(betterAuth)
  .get(
    '/',
    async ({ query }) => {
      return await TopicService.getTopics(query)
    },
    {
      query: TopicModel.List,
    },
  )
  .get(
    '/:id',
    async ({ params }) => {
      return await TopicService.getTopic(params)
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
