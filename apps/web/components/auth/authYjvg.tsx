'use client'
import { authClient } from '@web/lib/auth-client'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'

export default function AuthYjvg({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { data: session } = authClient.useSession()

  const _outlogin = () => {
    authClient.signOut()
    router.refresh()
  }
  if (session?.user.role !== 'admin')
    return (
      <div className="text-center">
        您没有权限喵～<Button onClick={_outlogin}>登出</Button>
      </div>
    )
  return <div>{children}</div>
}
