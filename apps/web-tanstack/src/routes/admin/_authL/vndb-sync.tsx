import { createFileRoute } from '@tanstack/react-router'
import VndbSyncPage from '@web/components/admin/vndb-sync-page'
import { getSyncProgress } from '@web/server/admin/vndb-sync'

export const Route = createFileRoute('/admin/_authL/vndb-sync')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ['admin', 'vndb-sync', 'progress'],
      queryFn: () => getSyncProgress(),
    })
  },
  component: VndbSyncPage,
})
