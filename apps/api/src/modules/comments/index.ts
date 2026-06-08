import { betterAuth } from '@api/modules/auth'
import { CommentModel } from '@api/modules/comments/model'
import { CommentService } from '@api/modules/comments/service'
import { Elysia } from 'elysia'

export const comments = new Elysia({ prefix: '/comments' })
  .use(betterAuth)
  .get(
    '/',
    async ({ query }) => {
      return await CommentService.getComments(query)
    },
    {
      query: CommentModel.List,
    },
  )
  .post(
    '/',
    async ({ body, user }) => {
      return await CommentService.createComment(body, user.id)
    },
    {
      auth: true,
      body: CommentModel.Create,
    },
  )
  .put(
    '/:id',
    async ({ params, body, user }) => {
      return await CommentService.updateComment(
        params,
        body,
        user.id,
        user.role,
      )
    },
    {
      auth: true,
      params: CommentModel.Params,
      body: CommentModel.Update,
    },
  )
  .delete(
    '/:id',
    async ({ params, user }) => {
      return await CommentService.deleteComment(
        params,
        user.id,
        user.role === 'admin',
      )
    },
    {
      auth: true,
      params: CommentModel.Params,
    },
  )
  .patch(
    '/:id/pin',
    async ({ params }) => {
      return await CommentService.togglePin(params)
    },
    {
      isAdmin: true,
      params: CommentModel.Params,
    },
  )
  .patch(
    '/:id/status',
    async ({ params, body }) => {
      return await CommentService.changeCommentStatus(params, body)
    },
    {
      isAdmin: true,
      params: CommentModel.Params,
      body: CommentModel.ChangeStatus,
    },
  )
