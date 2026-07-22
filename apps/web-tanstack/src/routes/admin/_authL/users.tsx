import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const UsersPage = lazy(() => import('@web/components/admin/users-page'))

export const Route = createFileRoute('/admin/_authL/users')({
  component: () => (
    <Suspense fallback={<div>加载中...</div>}>
      <UsersPage />
    </Suspense>
  ),
})
