import { betterAuth } from '@api/modules/auth'
import { auth } from '@api/modules/auth/service'
import { CommentModel } from '@api/modules/comments/model'
import { CommentService } from '@api/modules/comments/service'
import { topicViewerOf } from '@api/modules/topics/service'
import { Elysia } from 'elysia'

export const comments = new Elysia({ prefix: '/comments' })
  .use(betterAuth)
  .get(
    '/',
    async ({ query, request }) => {
      // 帖子评论跟随帖子可见性：未发布/已删除的帖子只有归属者与管理员能读；
      // 游戏等目标类型没有状态概念，不额外查会话。
      const session =
        query?.targetType === 'topic'
          ? await auth.api.getSession({ headers: request.headers })
          : null
      return await CommentService.getComments(query, topicViewerOf(session))
    },
    {
      query: CommentModel.List,
    },
  )
  .get(
    '/admin',
    async ({ query }) => {
      return await CommentService.getCommentsForAdmin(query)
    },
    {
      isAdmin: true,
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
