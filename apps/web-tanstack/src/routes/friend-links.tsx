import { createFileRoute } from '@tanstack/react-router'
import FriendLinksPage from '@web/components/friend-links-page'
import { seoTemplate } from '@web/config/seoTemplate'

export const Route = createFileRoute('/friend-links')({
  component: FriendLinksPage,
  head: () => ({
    meta: [
      { title: `友情链接 | ${seoTemplate.title}` },
      {
        name: 'description',
        content: '喵世界再大，有缘的小伙伴也能像在身边一样呢',
      },
    ],
  }),
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
})
