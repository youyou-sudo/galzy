import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { CollectionModel } from './model'
import { CollectionService } from './service'

export const collections = new Elysia({ prefix: '/collections' })
  .use(betterAuth)
  // 公开 API
  .get(
    '/',
    async ({ query }) => {
      return CollectionService.list(query as any)
    },
    { query: CollectionModel.List },
  )
  .get(
    '/:id',
    async ({ params }) => {
      return CollectionService.getById(Number(params.id))
    },
    { params: CollectionModel.Params },
  )
  .get(
    '/:id/preview',
    async ({ params, query }) => {
      return CollectionService.preview(Number(params.id), Number((query as any).limit ?? 6))
    },
    { params: CollectionModel.Params },
  )
  // 管理 API
  .post(
    '/',
    async ({ body, user }) => {
      if (user?.role !== 'admin') throw new Error('403: 无权操作')
      return CollectionService.create(body as any)
    },
    { auth: true, body: CollectionModel.Create },
  )
  .put(
    '/:id',
    async ({ params, body, user }) => {
      if (user?.role !== 'admin') throw new Error('403: 无权操作')
      return CollectionService.update(Number(params.id), body as any)
    },
    {
      auth: true,
      params: CollectionModel.Params,
      body: CollectionModel.Update,
    },
  )
  .delete(
    '/:id',
    async ({ params, user }) => {
      if (user?.role !== 'admin') throw new Error('403: 无权操作')
      return CollectionService.delete(Number(params.id))
    },
    { auth: true, params: CollectionModel.Params },
  )
  .put(
    '/:id/entries',
    async ({ params, body, user }) => {
      if (user?.role !== 'admin') throw new Error('403: 无权操作')
      return CollectionService.updateEntries(
        Number(params.id),
        (body as any).entries,
      )
    },
    {
      auth: true,
      params: CollectionModel.Params,
      body: CollectionModel.UpdateEntries,
    },
  )
