"use client"
import { authClient } from '@web/lib/auth-client'

export default function AuthYjvg({ children }: { children: React.ReactNode }) {
  const {
    data: session,
  } = authClient.useSession()
  if (session?.user.role !== "admin") return <div className='text-center'>您没有权限喵～</div>
  return (
    <div>{children}</div>
  )
}
