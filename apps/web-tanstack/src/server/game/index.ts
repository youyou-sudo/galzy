import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { assertOk } from '#/lib'

export const getGameDetail = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const getgame = await api.games.get({
      query: {
        id: data.id,
      },
    })
    return assertOk(getgame, 'game')
  })

export const getGameTags = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const res = await api.tags.gametags.post({ id: data.id })
    return assertOk(res, 'tags')
  })

export const getFileList = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const filelist = await api.games.openlistfiles.get({
      query: {
        id: data.id,
      },
    })
    return {
      game: assertOk(filelist, '文件列表'),
    }
  })

export const translateData = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const translate = await api.games.gameTimeNumberGet.get({
      query: { id: data.id, time: 'week' },
    })
    return assertOk(translate, 'translateData')
  })

export const dwAcConst = createServerFn()
  .inputValidator(z.object({ path: z.string(), game_id: z.string() }))
  .handler(async ({ data }) => {
    const res = await api.download.path.get({
      query: { path: data.path, game_id: data.game_id },
    })
    return assertOk(res, 'download path')
  })
