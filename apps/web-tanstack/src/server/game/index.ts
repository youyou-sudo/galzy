import { api } from '@libs'
import { createServerFn } from '@tanstack/react-start'
import { elysiaErrorF } from '@web/lib'
import z from 'zod'

export const getGameDetail = createServerFn()
  .validator(z.object({ id: z.string() }))
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
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { data: tags, error } = await api.tags.gametags.post({ id: data.id })
    elysiaErrorF(error)
    return tags
  })

export const getFileList = createServerFn()
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    try {
      const { data: filelist, error } = await api.games.openlistfiles.get({
        query: { id: data.id },
      })
      elysiaErrorF(error)
      return { game: filelist }
    } catch {
      return { game: [] }
    }
  })

export const translateData = createServerFn()
  .validator(
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
  .validator(z.object({ path: z.string(), game_id: z.string() }))
  .handler(async ({ data }) => {
    const { data: res, error } = await api.download.path.get({
      query: { path: data.path, game_id: data.game_id },
    })
    elysiaErrorF(error)
    return res
  })

export const getGameList = createServerFn()
  .validator(
    z
      .object({
        pageSize: z.optional(z.number()),
        pageIndex: z.optional(z.number()),
        sortBy: z.optional(z.string()),
        order: z.optional(z.string()),
        q: z.optional(z.string()),
        olang: z.optional(z.string()),
        tags: z.optional(z.union([z.string(), z.array(z.string())])),
      })
      .partial()
      .default({}),
  )
  .handler(async ({ data }) => {
    // Map legacy sortBy values to Meilisearch sortable attributes
    const sortByMap: Record<string, string> = {
      released: 'released_first',
      downloads: 'dl_count',
      views: 'vw_count',
      rating: 'rating',
      votecount: 'votecount',
      id: 'id',
    }
    const meiliSortBy = data.sortBy
      ? (sortByMap[data.sortBy] ?? data.sortBy)
      : undefined

    const { data: result, error } = await api.search.games.get({
      query: {
        q: data.q || '',
        page: (data.pageIndex || 0) + 1,
        hitsPerPage: data.pageSize || 24,
        sortBy: meiliSortBy as
          | 'released_first'
          | 'rating'
          | 'votecount'
          | 'dl_count'
          | 'vw_count'
          | 'id'
          | undefined,
        order: data.order as 'asc' | 'desc' | undefined,
        olang: data.olang,
        tags: data.tags,
      },
    })
    elysiaErrorF(error)
    return {
      gamelist: {
        items: result.hits,
        currentPage: (result.page || 1) - 1,
        totalPages: result.totalPages || 0,
        totalCount: result.totalHits || 0,
      },
    }
  })

export const getCritical = createServerFn().handler(async () => {
  const [gameResult, tagResult] = await Promise.allSettled([
    api.views.hot.game.get(),
    api.views.hot.tag.get(),
  ])

  const gameRes: Array<{
    id: string
    title: string | null
    total: number
  }> | null =
    gameResult.status === 'fulfilled' && !gameResult.value.error
      ? (gameResult.value.data ?? null)
      : null

  const tagRes: Array<{
    tag: string
    title: string | null
    total: number
  }> | null =
    tagResult.status === 'fulfilled' && !tagResult.value.error
      ? (tagResult.value.data ?? null)
      : null

  return {
    game: gameRes,
    tag: tagRes,
  }
})

export const getGameImages = createServerFn()
  .validator(z.object({ ids: z.array(z.string()) }))
  .handler(async ({ data }) => {
    const results = await Promise.all(
      data.ids.slice(0, 12).map(async (id) => {
        const { data: game, error } = await api.games.get({ query: { id } })
        elysiaErrorF(error)
        if (!game?.vn?.image) return null
        return {
          id,
          imageId: game.vn.image.id as string | null,
          imageWidth: game.vn.image.width as number | null,
          imageHeight: game.vn.image.height as number | null,
          cSexualAvg: (game.vn.image as Record<string, unknown>).cSexualAvg as
            | number
            | null,
        }
      }),
    )
    return results.filter(Boolean) as Array<{
      id: string
      imageId: string | null
      imageWidth: number | null
      imageHeight: number | null
      cSexualAvg: number | null
    }>
  })
