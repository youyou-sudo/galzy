import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { seoTemplate } from '@web/config/seoTemplate'

const ToolsPage = lazy(() => import('@web/components/tools/tools-page'))

export const Route = createFileRoute('/tools/')({
  component: () => (
    <Suspense fallback={<div>加载中...</div>}>
      <ToolsPage />
    </Suspense>
  ),
  head: () => ({
    meta: [
      { title: `工具箱 | ${seoTemplate.title}` },
      {
        name: 'description',
        content: '实用工具合集 — 车牌号跳转、相关站点导航等 Galgame 常用工具',
      },
    ],
  }),
})
