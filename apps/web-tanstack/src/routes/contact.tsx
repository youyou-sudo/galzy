import { createFileRoute } from '@tanstack/react-router'
import ContactPage from '@web/components/contact-page'
import { seoTemplate } from '@web/config/seoTemplate'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
  head: () => ({
    meta: [{ title: `联系喵喵们 | ${seoTemplate.title}` }],
  }),
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
})
