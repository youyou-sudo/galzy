import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const ArticlesPage = lazy(() => import('@web/components/admin/articles-page'))

export const Route = createFileRoute('/admin/_authL/articles')({
  component: () => (
    <Suspense fallback={<div>加载中...</div>}>
      <ArticlesPage />
    </Suspense>
  ),
})
