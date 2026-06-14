import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@web/components/ui/tabs'
import { elysiaErrorF } from '@web/lib'
import { authClient } from '@web/server/auth/auth-client'
import { Shield, User } from 'lucide-react'
import ProfileTab from './ProfileTab'
import SecurityTab from './SecurityTab'
import UserHeader from './UserHeader'

interface ProfileMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ProfileMenu({ open, onOpenChange }: ProfileMenuProps) {
  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const { data: res, error } = await authClient.getSession()
      elysiaErrorF(error)
      return res
    },
  })
  const user = session?.user

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <UserHeader
            name={user.name}
            email={user.email}
            image={user.image}
            profileMenu={false}
          />
          {/* Kept here for the SR-only title/description a11y pattern */}
          <DialogTitle className="sr-only">{user.name}</DialogTitle>
          <DialogDescription className="sr-only">
            {user.email}
          </DialogDescription>
        </DialogHeader>
        <div>点击头像上传头像喵～</div>
        <div>用户系统正在完善喵～</div>
        <Tabs defaultValue="profile">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="profile" className="flex-1">
              <User className="size-4" />
              个人资料
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1">
              <Shield className="size-4" />
              安全
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <ProfileTab user={user} onProfileUpdated={refetchSession} />
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            <SecurityTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
