import { betterAuth } from '@api/modules/auth'
import { Elysia } from 'elysia'
import { UsersModel } from './model'
import { UserService } from './service'

export const users = new Elysia({ prefix: '/users' })
  .use(betterAuth)
  .get('/admin', async ({ query }) => await UserService.adminList(query), {
    isAdmin: true,
    query: UsersModel.adminList,
  })
