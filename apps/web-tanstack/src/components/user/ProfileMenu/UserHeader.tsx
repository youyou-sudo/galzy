import { Mail } from 'lucide-react'
import AvatarComp from './AvatarEditor'

interface UserHeaderProps {
  name?: string | null
  email?: string | null
  image?: string | null
  profileMenu?: boolean
}

export default function UserHeader({
  name,
  email,
  image,
  profileMenu,
}: UserHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <AvatarComp name={name} image={image} editor={true} />
      <div className={`${profileMenu ? 'max-w-39' : 'max-w-80'}`}>
        <h2
          className={`text-lg font-semibold leading-none tracking-tight truncate`}
        >
          {name}
        </h2>
        <p className={`text-sm text-muted-foreground flex items-center gap-1 `}>
          <Mail className="size-4" />
          <span className={`truncate`}>{email}</span>
        </p>
      </div>
    </div>
  )
}
