import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { seoMeta } from '@web/lib/seo'
import { getSession } from '@web/server/auth/auth.functions'

export const Route = createFileRoute('/admin/_authL')({
  component: RouteComponent,
  head: () =>
    seoMeta({
      title: '管理后台 | GalZY - Galgame 资源站',
      noindex: true,
    }),
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/auth/login' })
    }
    if (session?.user.role !== 'admin') {
      throw redirect({ to: '/' })
    }
  },
})

function RouteComponent() {
  return <Outlet />
}
