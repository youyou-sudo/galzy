import { createFileRoute } from '@tanstack/react-router'
import { getSession } from '@web/server/auth/auth.functions'

export const Route = createFileRoute('/admin/')({
  component: RouteComponent,
  loader: async () => {
    const authSession = await getSession()
    const isAdmin = authSession?.user.role === 'admin'
    if (!isAdmin) {
      throw new Error('不是管理员喵～')
    }
    return authSession
  },
})

function RouteComponent() {
  return <div>Hello "/admin/"!</div>
}
