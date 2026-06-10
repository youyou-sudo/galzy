import { Image } from '@unpic/react'
import { authClient } from '@web/server/auth/auth-client'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { FaDiscord, FaGithub, FaTwitter } from 'react-icons/fa'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'

type Provider = 'github' | 'linuxdo' | 'discord' | 'kungal' | 'twitter'

export const OauthButton = () => {
  const [loading, setLoading] = useState<Provider | null>(null)
  const params = new URLSearchParams(window.location.search)

  const return_toss = params.get('return_to')
  const return_to = `${return_toss ? return_toss : ''}`

  const handleSocialSignIn = async (provider: Provider) => {
    setLoading(provider)
    try {
      if (provider === 'linuxdo') {
        return await authClient.signIn.oauth2({
          providerId: 'linuxdo',
          callbackURL: `${window.location.origin}/${return_to}`,
          requestSignUp: false,
        })
      }
      if (provider === 'kungal') {
        return await authClient.signIn.oauth2({
          providerId: 'kungal',
          callbackURL: `${window.location.origin}/${return_to}`,
          requestSignUp: false,
        })
      }
      await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}/${return_to}`,
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <Separator />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          disabled={loading === 'kungal'}
          onClick={() => handleSocialSignIn('kungal')}
        >
          {loading === 'kungal' && <Loader2 className="animate-spin" />}
          <Image
            src="/kungal.webp"
            width={16}
            height={16}
            alt="这是 KunGalgame 登陆按钮图标"
            data-icon="inline-start"
            className="rounded-4xl"
          />
          Kun Galgame
        </Button>
        <Button
          disabled={loading === 'github'}
          onClick={() => handleSocialSignIn('github')}
        >
          {loading === 'github' && <Loader2 className="animate-spin" />}
          <FaGithub data-icon="inline-start" />
          Github
        </Button>

        <Button
          disabled={loading === 'twitter'}
          onClick={() => handleSocialSignIn('twitter')}
        >
          {loading === 'twitter' && <Loader2 className="animate-spin" />}
          <FaTwitter data-icon="inline-start" />
          twitter
        </Button>

        <Button
          disabled={loading === 'linuxdo'}
          onClick={() => handleSocialSignIn('linuxdo')}
        >
          {loading === 'linuxdo' && <Loader2 className="animate-spin" />}
          <Image
            src="/linuxdo.webp"
            width={16}
            height={16}
            alt="这是 linux.do 登陆按钮图标"
            data-icon="inline-start"
            className="rounded-4xl"
          />
          Linux.Do
        </Button>

        <Button
          disabled={loading === 'discord'}
          onClick={() => handleSocialSignIn('discord')}
        >
          {loading === 'discord' && <Loader2 className="animate-spin" />}
          <FaDiscord data-icon="inline-start" />
          Discord
        </Button>
      </div>
    </div>
  )
}
