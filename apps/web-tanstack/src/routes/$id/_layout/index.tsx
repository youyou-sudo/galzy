import { api } from '@libs'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { DownloadOptions } from '#/components/home/game/download-options'
import { assertOk } from '#/lib/assertOk'

const getFileList = createServerFn()
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

export const Route = createFileRoute('/$id/_layout/')({
  component: DownloadComponent,
  loader: async ({ params }) => {
    const { id } = params
    const filelist = await getFileList({ data: { id } })
    return {
      filelist,
    }
  },
  // CDN caching (via headers)
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }),
  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})

function DownloadComponent() {
  const { filelist } = Route.useLoaderData()
  if (!filelist) {
    return <div>没有找到文件列表喵～</div>
  }
  return <>{filelist.game && <DownloadOptions />}</>
}
