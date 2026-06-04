import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import z from 'zod'

export const getGameDetail = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: getgame, error } = await api.games.get({
      query: {
        id: data.id,
      },
    })
    elysiaErrorF(error)
    return getgame
  })

export const getGameTags = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: tags, error } = await api.tags.gametags.post({ id: data.id })
    elysiaErrorF(error)
    return tags
  })

export const getFileList = createServerFn()
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: filelist, error } = await api.games.openlistfiles.get({
      query: {
        id: data.id,
      },
    })
    elysiaErrorF(error)
    return {
      game: filelist,
    }
  })

export const translateData = createServerFn()
  .inputValidator(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: translate, error } = await api.games.gameTimeNumberGet.get({
      query: { id: data.id, time: 'week' },
    })
    elysiaErrorF(error)
    return translate
  })

export const dwAcConst = createServerFn()
  .inputValidator(z.object({ path: z.string(), game_id: z.string() }))
  .handler(async ({ data }) => {
    const { data: res, error } = await api.download.path.get({
      query: { path: data.path, game_id: data.game_id },
    })
    elysiaErrorF(error)
    return res
  })
