import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'

export default function AccountTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <h4 className="text-sm font-medium">账户偏好</h4>
        <p className="text-xs text-muted-foreground mt-1">
          管理您的账户设置和偏好。
        </p>
      </div>
      <div className="space-y-2">
        <Label>语言</Label>
        <Input defaultValue="English" disabled className="opacity-60" />
      </div>
      <div className="space-y-2">
        <Label>时区</Label>
        <Input
          defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
          disabled
          className="opacity-60"
        />
      </div>
    </div>
  )
}
