import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const VndbSyncPage = lazy(() => import('@web/components/admin/vndb-sync-page'))

export const Route = createFileRoute('/admin/_authL/vndb-sync')({
  component: () => (
    <Suspense fallback={<div>加载中...</div>}>
      <VndbSyncPage />
    </Suspense>
  ),
})
