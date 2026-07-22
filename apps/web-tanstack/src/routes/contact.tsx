import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { seoTemplate } from '@web/config/seoTemplate'

const ContactPage = lazy(() => import('@web/components/contact-page'))

export const Route = createFileRoute('/contact')({
  component: () => (
    <Suspense fallback={<div>加载中...</div>}>
      <ContactPage />
    </Suspense>
  ),
  head: () => ({
    meta: [{ title: `联系喵喵们 | ${seoTemplate.title}` }],
  }),
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
})
