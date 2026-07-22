import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { seoTemplate } from '@web/config/seoTemplate'

const PlatePage = lazy(() => import('@web/components/tools/plate-page'))

export const Route = createFileRoute('/tools/plate')({
  component: () => (
    <Suspense fallback={<div>加载中...</div>}>
      <PlatePage />
    </Suspense>
  ),
  head: () => ({
    meta: [
      { title: `车牌号跳转工具 | ${seoTemplate.title}` },
      {
        name: 'description',
        content:
          '输入车牌号，快速跳转到 nhentai、禁漫天堂、Hitomi.la、Pixiv 等网站喵～',
      },
    ],
  }),
})
