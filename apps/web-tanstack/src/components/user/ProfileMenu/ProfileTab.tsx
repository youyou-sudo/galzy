import { useQueries, useQuery } from '@tanstack/react-query'
import { Image } from '@unpic/react'
import { Button } from '@web/components/ui/button'
import { Input } from '@web/components/ui/input'
import { Label } from '@web/components/ui/label'
import { Skeleton } from '@web/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@web/components/ui/tooltip'
import { getAccountInfo, listAccounts } from '@web/server/auth/auth.functions'
import { authClient } from '@web/server/auth/auth-client'
import { Check, Loader2 } from 'lucide-react'
import { type ChangeEvent, useState } from 'react'
import { FaDiscord, FaGithub, FaTwitter } from 'react-icons/fa'

type ProviderType = 'social' | 'oauth2'

interface OAuthProviderDef {
  id: string
  name: string
  iconType: 'fa'
  Icon: typeof FaGithub
  type: ProviderType
}

interface OAuthProviderImageDef {
  id: string
  name: string
  iconType: 'image'
  iconSrc: string
  type: ProviderType
}

const OAUTH_PROVIDERS: (OAuthProviderDef | OAuthProviderImageDef)[] = [
  {
    id: 'github',
    name: 'GitHub',
    iconType: 'fa',
    Icon: FaGithub,
    type: 'social',
  },
  {
    id: 'discord',
    name: 'Discord',
    iconType: 'fa',
    Icon: FaDiscord,
    type: 'social',
  },
  {
    id: 'twitter',
    name: 'Twitter',
    iconType: 'fa',
    Icon: FaTwitter,
    type: 'social',
  },
  {
    id: 'linuxdo',
    name: 'Linux.Do',
    iconType: 'image',
    iconSrc: '/linuxdo.webp',
    type: 'oauth2',
  },
  {
    id: 'kungal',
    name: 'Kun Galgame',
    iconType: 'image',
    iconSrc: '/kungal.webp',
    type: 'oauth2',
  },
]

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
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(
    null,
  )

  const {
    data: accounts = [],
    refetch: refetchAccounts,
    isPending: isAccountsPending,
  } = useQuery({
    queryKey: ['linked-accounts'],
    queryFn: async () => {
      const { data, error } = await listAccounts()
      if (error) throw error
      return data ?? []
    },
  })

  const accountInfoQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: ['account-info', account.accountId],
      queryFn: async () => {
        const { data } = await getAccountInfo({
          data: { accountId: account.accountId },
        })
        return data?.user?.name ?? null
      },
      enabled: accounts.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const accountNameMap = new Map(
    accounts.map((account, i) => [account.accountId, accountInfoQueries[i]]),
  )
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

  const handleLink = async (providerId: string, type: ProviderType) => {
    setLinkingProvider(providerId)
    try {
      const callbackURL = `${window.location.origin}/user`
      const errorCallbackURL = callbackURL
      if (type === 'oauth2') {
        await authClient.oauth2.link({
          providerId,
          callbackURL,
          errorCallbackURL,
        })
      } else {
        await authClient.linkSocial({
          provider: providerId,
          callbackURL,
          errorCallbackURL,
        })
      }
    } finally {
      setLinkingProvider(null)
    }
  }

  const handleUnlink = async (providerId: string, accountId: string) => {
    setUnlinkingProvider(providerId)
    try {
      const { error } = await authClient.unlinkAccount({
        providerId,
        accountId,
      })
      if (!error) {
        await refetchAccounts()
      }
    } finally {
      setUnlinkingProvider(null)
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
        <Label>邮箱</Label>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="flex min-h-8 w-full min-w-0 items-center rounded-lg border border-input bg-input/30 px-2.5 py-1 text-sm text-muted-foreground break-all dark:bg-input/80">
              {user.email ?? '未设置邮箱'}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{user.email}</p>
          </TooltipContent>
        </Tooltip>
        <p className="text-xs text-muted-foreground">
          邮箱无法直接修改，如需帮助请联系管理员喵。
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium">关联账户</h4>
          <p className="text-xs text-muted-foreground mt-1">
            绑定第三方账户以便快速登录喵。
          </p>
        </div>
        <div className="space-y-2">
          {OAUTH_PROVIDERS.map((provider) => {
            const linkedAccount = accounts?.find(
              (a) => a.providerId === provider.id,
            )
            const isLinked = !!linkedAccount
            const isProcessing =
              linkingProvider === provider.id ||
              unlinkingProvider === provider.id

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {provider.iconType === 'fa' ? (
                    <provider.Icon className="size-5" />
                  ) : (
                    <Image
                      src={provider.iconSrc}
                      width={20}
                      height={20}
                      alt={`${provider.name} 图标`}
                      className="rounded-sm"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium">{provider.name}</p>
                    {isAccountsPending ? (
                      <Skeleton className="mt-1 h-3 w-10" />
                    ) : (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {isLinked ? (
                          <>
                            已绑定
                            <Check size={15} className="text-green-600" />
                            {(() => {
                              const q = accountNameMap.get(
                                linkedAccount!.accountId,
                              )
                              if (q?.isPending) {
                                return <Skeleton className="h-3 w-12" />
                              }
                              if (q?.data) {
                                return (
                                  <span className="text-muted-foreground/70">
                                    · {q.data}
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </>
                        ) : (
                          '未绑定'
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {isLinked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleUnlink(provider.id, linkedAccount!.id)}
                  >
                    {isProcessing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      '解绑'
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleLink(provider.id, provider.type)}
                  >
                    {isProcessing ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      '绑定'
                    )}
                  </Button>
                )}
              </div>
            )
          })}

          <p className="text-xs text-muted-foreground mt-1">
            如果已经通过第三方登陆创建过账户，且邮件不一样，请联系管理员喵～
          </p>
        </div>
      </div>
    </div>
  )
}
