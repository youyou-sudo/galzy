import { Elysia } from 'elysia'
import { CharacterModel } from './model'
import { Character } from './service'

/**
 * 角色查询（公开只读）。
 *
 * 数据源只有 kungal（NextMoe·未萌）：角色表是 galrc_kungal_characters，
 * 按作品查角色走 appearances。vndb 只提供作品锚点，不提供角色数据。
 */
export const characters = new Elysia({ prefix: '/characters' })
  .get(
    '/game',
    async ({ query: { gameId } }) => await Character.Game({ gameId }),
    {
      query: CharacterModel.gameQuery,
    },
  )
  .get('/info', async ({ query: { id } }) => await Character.Info({ id }), {
    query: CharacterModel.infoQuery,
  })
