import { MotionHighlight } from '@web/components/animate-ui/effects/motion-highlight'
import { Avatar, AvatarFallback, AvatarImage } from '@web/components/ui/avatar'
import { LinkIcon } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const linksList: {
  title: string
  avatar: string
  href: string
  description: string
}[] = [
  {
    title: '莱茵',
    avatar: '/telegram.png',
    href: 'https://t.me/RhineLibrary',
    description: '一个 Telegram Galgame 资源频道',
  },
  {
    title: 'Steam 上的中文 Galgame',
    avatar:
      'https://steamgalgame.com/usr/themes/SteamGalgame/static/img/favicon.png',
    href: 'https://steamgalgame.com',
    description: '',
  },
  {
    title: '莉斯坦 ACG',
    avatar: 'https://www.limulu.moe/favicon.ico',
    href: 'https://www.limulu.moe',
    description: '一个简洁美观人性化的 ACG 资源站',
  },
  {
    title: '鲲 Galgame 论坛',
    avatar: 'https://www.kungal.com/favicon.ico',
    href: 'https://www.kungal.com',
    description: '世界上最萌的 Galgame 论坛! ',
  },
  {
    title: 'Hikarinagi',
    avatar: 'https://www.hikarinagi.org/favicon.ico',
    href: 'https://www.hikarinagi.org',
    description: 'Hikarinagi 致力于为所有ACG爱好者提供一个交流和分享的平台! ',
  },
  {
    title: 'KisuGal',
    avatar: 'https://kisuacg.moe/_next/image?url=%2Ffavicon.webp&w=64&q=75',
    href: 'https://kisuacg.moe',
    description: '免费的 GalGame 资源分享平台！',
  },
]

export default function Youyou() {
  return (
    <article>
      <div className="p-2">
        <div className="mb-6 ml-1 space-y-4">
          <h1 className="flex justify-center items-center text-4xl font-bold ">
            🐾喵の朋友们
          </h1>
          <p className="ml-1 text-center">
            喵世界再大，有缘的小伙伴也能像在身边一样呢
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ">
          <MotionHighlight hover className="rounded-xl">
            {linksList.map((item, index) => (
              <Link href={item.href} key={index} target="_blank">
                <div className="h-32 flex flex-col border rounded-md p-4">
                  <div className="flex space-x-5">
                    <Avatar className="flex">
                      <AvatarImage src={item.avatar} />
                      <AvatarFallback>{item.title}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 items-center justify-center space-y-2">
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-sm">{item.description}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </MotionHighlight>
        </div>
      </div>
    </article>
  )
}
