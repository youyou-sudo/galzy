import { createFileRoute } from '@tanstack/react-router'
import ToolsPage from '@web/components/tools/tools-page'
import { seoTemplate } from '@web/config/seoTemplate'

export const Route = createFileRoute('/tools/')({
  component: ToolsPage,
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
