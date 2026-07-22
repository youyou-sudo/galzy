import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const CommentsPage = lazy(() => import('@web/components/admin/comments-page'))

export const Route = createFileRoute('/admin/_authL/comments')({
  component: () => (
    <Suspense fallback={<div>加载中...</div>}>
      <CommentsPage />
    </Suspense>
  ),
})
