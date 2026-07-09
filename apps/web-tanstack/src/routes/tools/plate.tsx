import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Input } from '@web/components/ui/input'
import { seoTemplate } from '@web/config/seoTemplate'
import { ExternalLink, Hash } from 'lucide-react'
import { useState } from 'react'

const sites = [
  {
    id: 'nhentai',
    name: 'nhentai',
    url: 'https://nhentai.net/g/{id}/',
    icon: 'N',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
  {
    id: '18comic',
    name: '禁漫天堂 (18comic)',
    url: 'https://18comic.vip/album/{id}/',
    icon: '禁',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
  },
  {
    id: 'ehentai',
    name: 'E-Hentai',
    url: 'https://e-hentai.org/g/{id}/',
    icon: 'E',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    id: 'exhentai',
    name: 'ExHentai',
    url: 'https://exhentai.org/g/{id}/',
    icon: 'Ex',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    id: 'pixiv-artwork',
    name: 'Pixiv 作品',
    url: 'https://www.pixiv.net/artworks/{id}/',
    icon: '绘',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
  },
  {
    id: 'pixiv-author',
    name: 'Pixiv 作者',
    url: 'https://www.pixiv.net/users/{id}/',
    icon: '人',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    id: 'gelbooru',
    name: 'Gelbooru',
    url: 'https://gelbooru.com/index.php?page=post&s=view&id={id}',
    icon: 'G',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    id: 'hitomi',
    name: 'Hitomi.la',
    url: 'https://hitomi.la/galleries/{id}.html',
    icon: 'H',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
]

export const Route = createFileRoute('/tools/plate')({
  component: RouteComponent,
  head: () => ({
    meta: [
      { title: `车牌号跳转工具 | ${seoTemplate.title}` },
      {
        name: 'description',
        content:
          '输入车牌号，快速跳转到 nhentai、禁漫天堂、Hitomi.la、Pixiv 等网站喵～',
      },
    ],
  }),
})

function RouteComponent() {
  const [plate, setPlate] = useState('')

  const openSite = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const resolvedUrl = (url: string) =>
    url.replace('{id}', plate.trim() || '{id}')

  return (
    <section className="flex justify-center items-start min-h-[60vh]">
      <div className="p-4 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">车牌号跳转工具</h1>
          <p className="text-muted-foreground">输入车牌号，直通车喵～</p>
        </div>

        {/* Prominent Input — THE primary action */}
        <div className="relative mb-8">
          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
          <Input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="输入车牌号..."
            className="h-12 pl-12 text-lg rounded-xl"
          />
        </div>

        {/* Site Grid — always visible */}
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          选择班次喵～
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sites.map((site) => (
            <Card key={site.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center size-6 rounded ${site.bg} ${site.color} text-xs font-bold`}
                  >
                    {site.icon}
                  </span>
                  {site.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {plate.trim() ? (
                  <>
                    <p className="text-xs text-muted-foreground truncate mb-2">
                      {resolvedUrl(site.url)}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full cursor-pointer"
                      onClick={() =>
                        openSite(site.url.replace('{id}', plate.trim()))
                      }
                    >
                      <ExternalLink data-icon="inline-start" />
                      打开
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full cursor-pointer"
                    disabled
                  >
                    <ExternalLink data-icon="inline-start" />
                    输入车牌号后可上车喵～
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
