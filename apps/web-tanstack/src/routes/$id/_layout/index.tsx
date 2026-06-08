import { createFileRoute } from '@tanstack/react-router'
import { DownloadOptions } from '@web/components/home/game/download-options'
import { getFileList } from '@web/server/game'

export const Route = createFileRoute('/$id/_layout/')({
  component: DownloadComponent,
  loader: async ({ params }) => {
    const { id } = params
    const filelist = getFileList({ data: { id } })
    return {
      filelist,
    }
  },
  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})

function DownloadComponent() {
  return <DownloadOptions />
}
