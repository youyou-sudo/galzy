import { Button } from '@web/components/ui/button'
import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'
import { authClient } from '@web/server/auth/auth-client'
import { Loader2 } from 'lucide-react'
import { type ChangeEvent, useState } from 'react'

interface ProfileTabProps {
  user: NonNullable<ReturnType<typeof authClient.useSession>['data']>['user']
  onProfileUpdated: () => void
}

export default function ProfileTab({
  user,
  onProfileUpdated,
}: ProfileTabProps) {
  const [name, setName] = useState(user.name ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveProfile = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await authClient.updateUser({ name })
      onProfileUpdated()
    } catch {
      // Error is handled by better-auth
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name">显示名称</Label>
        <div className="flex gap-2">
          <Input
            id="profile-name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="请输入您的名称"
          />
          <Button
            size="sm"
            disabled={isSaving || !name.trim() || name === user.name}
            onClick={handleSaveProfile}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : '保存'}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">邮箱</Label>
        <Input
          id="profile-email"
          value={user.email ?? ''}
          disabled
          className="opacity-60"
        />
        <p className="text-xs text-muted-foreground">
          邮箱无法直接修改，如需帮助请联系管理员喵。
        </p>
      </div>
    </div>
  )
}
