import { Avatar, AvatarFallback, AvatarImage } from '@web/components/ui/avatar'
import { Mail } from 'lucide-react'

interface UserHeaderProps {
  name?: string | null
  email?: string | null
  image?: string | null
}

export default function UserHeader({ name, email, image }: UserHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg">
        <AvatarImage src={image ?? undefined} alt={name ?? ''} />
        <AvatarFallback>{name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
      </Avatar>
      <div>
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          {name}
        </h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Mail className="size-3" />
          {email}
        </p>
      </div>
    </div>
  )
}
