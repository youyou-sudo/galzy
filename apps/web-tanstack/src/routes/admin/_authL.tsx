import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSession } from '@web/server/auth/auth.functions'

export const Route = createFileRoute('/admin/_authL')({
  component: RouteComponent,
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
