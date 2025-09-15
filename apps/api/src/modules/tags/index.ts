import { Elysia } from 'elysia'
import { TagsModel } from './model'
import { Tags } from './service'

export const tags = new Elysia({ prefix: '/tags' })
  .get(
    '/tag',
    async ({ query: { tagId } }) => {
      return await Tags.tag({ tagId })
    },
    {
      query: TagsModel.tagId,
    },
  )
  .post(
    '/tagall',
    async ({ body: { pageSize, pageIndex, keyword, id } }) => {
      return Tags.tagAllGet({ pageSize, pageIndex, keyword, id })
    },
    {
      body: TagsModel.tagAll,
    },
  )
  .post(
    '/gametags',
    async ({ body: { id } }) => {
      return Tags.gameTags({ id })
    },
    { body: TagsModel.gameTags },
  )
  .post(
    '/taggames',
    async ({ body: { tagId, pageSize, pageIndex } }) => {
      return Tags.tagGames({ tagId, pageSize, pageIndex })
    },
    {
      body: TagsModel.tagGames,
    },
  )

  .post(
    '/tagedit',
    async ({ body: { id, zh_name, exhibition, zh_alias, zh_description } }) => {
      return await Tags.tagEdit({
        id,
        zh_name,
        exhibition,
        zh_alias,
        zh_description,
      })
    },
    {
      body: TagsModel.tagEdit,
    },
  )
  .post(
    '/tagFileUp',
    async ({ body }) => {
      const datas = await Tags.tagFileAdd(body)
      return datas
    },
    {
      body: TagsModel.tagFileAdd,
    },
  )

  .get('/tagAllFileDwn', async () => {
    const datas = await Tags.tagAllFileDwn()
    return datas
  })
