import { Button } from '@shadcn/ui/components/button'
import { authServerClient } from '@web/lib/auth/auth-server'
import { refresh } from 'next/cache'

export const dynamic = 'force-dynamic'

export default async function AuthYjvg({
  children,
}: {
  children: React.ReactNode
}) {
  const { data } = await authServerClient.getSession()

  const _outlogin = () => {
    authServerClient.signOut()
    refresh()
  }
  if (data?.user.role !== 'admin')
    return (
      <div className="text-center">
        您没有权限喵～
        <form action={_outlogin}>
          <Button type="submit">登出</Button>
        </form>
      </div>
    )
  return <div>{children}</div>
}
