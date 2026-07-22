import { createFileRoute } from '@tanstack/react-router'
import PlatePage from '@web/components/tools/plate-page'
import { seoTemplate } from '@web/config/seoTemplate'

export const Route = createFileRoute('/tools/plate')({
  component: PlatePage,
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
