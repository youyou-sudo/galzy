'use client'
import { Avatar, AvatarFallback, AvatarImage } from '@web/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@web/components/animate-ui/components/radix/dropdown-menu'

import { authClient } from '@web/lib/auth-client'

export function Account() {
  const { data: session } = authClient.useSession()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="头像" />
          <AvatarFallback>H</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src="https://github.com/shadcn.png" alt="头像" />
              <AvatarFallback className="rounded-lg">H</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">
                {session?.user.email}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {session?.user.name}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {session ? (
            session.user.role === 'admin' && (
              <DropdownMenuItem>仪表盘</DropdownMenuItem>
            )
          ) : (
            <>
              <DropdownMenuItem>登录</DropdownMenuItem>
              <DropdownMenuItem>注册</DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>

        {session && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                authClient.signOut()
              }}
            >
              登出
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
