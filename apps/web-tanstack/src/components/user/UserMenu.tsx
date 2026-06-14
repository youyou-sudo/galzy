import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@web/components/ui/dropdown-menu'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import { LogOut, User, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import AvatarComp from './ProfileMenu/AvatarEditor'
import UserHeader from './ProfileMenu/UserHeader'

export default function UserMenu() {
  const queryClient = useQueryClient()
  const { data: session, isPending } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })

  if (isPending) {
    return <div className="size-8 rounded-full bg-muted animate-pulse" />
  }

  if (!session) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/auth/login">
          <User className="size-3" />
          登录
        </Link>
      </Button>
    )
  }

  const { user } = session

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AvatarComp name={user.name} image={user.image} editor={false} />
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
            profileMenu={true}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/user">
            <UserCog className="size-4" />
            个人设置
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () =>
            await authClient.signOut({
              fetchOptions: {
                onError: () => {
                  toast.error(`退出登陆失败喵`)
                },
                onSuccess: () => {
                  queryClient.invalidateQueries({
                    queryKey: ['auth'],
                  })
                  toast.success(`退出登陆成功喵～`)
                },
              },
            })
          }
        >
          <LogOut className="size-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
