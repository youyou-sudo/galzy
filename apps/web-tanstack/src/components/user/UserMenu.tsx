import { Link } from '@tanstack/react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@web/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@web/components/ui/dropdown-menu'
import { authClient } from '@web/server/auth/auth-client'
import { LogOut, User, UserCog } from 'lucide-react'
import { useState } from 'react'
import ProfileMenu from './ProfileMenu'
import UserHeader from './ProfileMenu/UserHeader'

export default function UserMenu() {
  const { data: session, isPending } = authClient.useSession()
  const [profileOpen, setProfileOpen] = useState(false)

  if (isPending) {
    return <div className="size-8 rounded-full bg-muted animate-pulse" />
  }

  if (!session?.user) {
    return (
      <Link
        to="/auth/login"
        className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors rounded-md"
      >
        <User className="size-4" />
        登录
      </Link>
    )
  }

  const { user } = session

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar size="default">
              <AvatarImage
                src={user.image ?? undefined}
                alt={user.name ?? ''}
              />
              <AvatarFallback>
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>账户</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-1.5 py-2">
            <UserHeader
              name={user.name}
              email={user.email}
              image={user.image}
            />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserCog className="size-4" />
            个人设置
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              void authClient.signOut()
            }}
          >
            <LogOut className="size-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileMenu open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  )
}
