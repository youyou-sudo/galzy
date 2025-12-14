'use client'

import type { GameModel } from '@api/modules/games/model'
import { useQuery } from '@tanstack/react-query'
import {
  File,
  Files,
  Folder,
} from '@web/components/animate-ui/components/files'
import { MarkdownAsync } from '@web/components/markdownAync'
import { Button } from '@web/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@web/components/ui/item'
import { CopyButton } from '@web/components/ui/shadcn-io/copy-button'
import { Skeleton } from '@web/components/ui/skeleton'
import { dwAcConst } from '@web/lib/download/ac'
import {
  BadgeCheckIcon,
  Check,
  ChevronRightIcon,
  Copy,
  Download,
  FileArchive,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { tryit } from 'radash'
import { useState } from 'react'
import { toast } from 'sonner'
import { downCardDataStore } from './stores/downCardData'
import { GlgczujmDl } from './tips'

export function CopyButtons({ id }: { id?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (id) {
      const url = `${window.location.origin}/api/download?path=${id}`
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 3000) // 3秒后恢复图标
        })
        .catch(() => {
          alert('复制失败，请手动复制链接。')
        })
    }
  }

  return (
    <Button
      onClick={handleCopy}
      variant="outline"
      className="flex items-center space-x-1"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
      <span>复制链接</span>
    </Button>
  )
}

export function DownloadOptions({
  fileList,
}: {
  fileList: GameModel.TreeNode[]
}) {
  return <FileExplorer items={fileList} />
}

// ---------- 分卷文件识别处理 ----------
// ---------- 分卷文件识别处理 + md 同名判定 ----------
function groupSplitArchives(
  items: GameModel.TreeNode[] | undefined,
): GameModel.TreeNode[] | undefined {
  if (!items || items.length === 0) return items

  const archivesMap: Record<string, GameModel.TreeNode[]> = {}
  const others: GameModel.TreeNode[] = []

  // 先收集当前目录的所有 md 文件
  const mdMap: Record<string, string> = {} // name -> id
  items.forEach((item) => {
    if (item.type !== 'folder' && item.name.endsWith('.md')) {
      const nameWithoutExt = item.name.replace(/\.md$/i, '')
      mdMap[nameWithoutExt] = item.id
    }
  })

  // 匹配分卷文件，捕获 baseName 和扩展名
  const splitRegex = /(.*?)(?:\.part\d+)\.(rar|zip|7z)$/i

  items.forEach((item) => {
    if (item.type === 'folder') {
      // 避免重复包装分卷文件夹
      if (!item.name.startsWith('(分卷) ')) {
        item.children = groupSplitArchives(
          item.children ?? [],
        ) as typeof item.children
      }
      others.push(item)
    } else if (!item.name.endsWith('.md')) {
      // 忽略 md 文件本身
      const match = item.name.match(splitRegex)
      if (match) {
        const baseName = match[1]
        const ext = match[2]
        const key = `${baseName}.${ext}`
        if (!archivesMap[key]) archivesMap[key] = []

        // 检查同名 md 文件
        if (mdMap[baseName]) {
          item.redame = mdMap[baseName]
        }

        archivesMap[key].push(item)
      } else {
        // 普通文件也检查同名 md
        const nameWithoutExt = item.name.replace(/\.[^/.]+$/, '')
        if (mdMap[nameWithoutExt]) {
          item.redame = mdMap[nameWithoutExt]
        }
        others.push(item)
      }
    }
  })

  const archiveFolders = Object.entries(archivesMap).map(
    ([fullName, files]) => ({
      id: `archive-${fullName}-${Date.now()}`,
      type: 'folder' as const,
      name: `(分卷) ${fullName}`,
      volumes: true,
      children: files!,
    }),
  )

  return [...others, ...archiveFolders]
}

// ---------- 文件浏览器组件 ----------
function FileExplorer({ items }: { items: GameModel.TreeNode[] }) {
  const simplifiedItems = (() => {
    if (
      items &&
      items[0]?.type === 'folder' &&
      Array.isArray(items[0].children)
    ) {
      return groupSplitArchives(items[0].children)
    }
    return groupSplitArchives(items)
  })()

  return (
    <Files
      defaultOpen={['PC', 'KR', 'ONS', 'TY', 'CG']}
      className="bg-transparent border-0 mb-2"
    >
      <DownCardDialog />
      <Filessss items={simplifiedItems} />
    </Files>
  )
}

// ---------- 文件/文件夹递归渲染 ----------
const Filessss = ({ items }: { items: GameModel.TreeNode[] | undefined }) => {
  const open = downCardDataStore((s) => s.open)
  const setData = downCardDataStore((s) => s.setData)

  return (
    <>
      {items?.map((item) =>
        item.type === 'folder' && item.volumes !== true ? (
          <Folder name={item.name} key={item.name}>
            {item.children && <Filessss items={item.children} />}
          </Folder>
        ) : (
          <File
            className="underline underline-offset-4 hover:decoration-sky-500"
            name={item.name}
            key={item.name}
            onClick={() => {
              setData(item)
              open()
            }}
          />
        ),
      )}
    </>
  )
}

// ---------- 下载弹窗 ----------
export const DownCardDialog = () => {
  const isOpen = downCardDataStore((s) => s.isOpen)
  const setOpen = downCardDataStore((s) => s.setOpen)
  const data = downCardDataStore((s) => s.data)
  const close = downCardDataStore((s) => s.close)

  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>(
    {},
  )
  const [isCopying, setIsCopying] = useState<Record<string, boolean>>({})

  // 文件大小格式化
  function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 字节'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['字节', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }
  const pathname = usePathname()
  const game_id = pathname.split('/')[1]
  // 下载 README
  const { data: readmedata, isLoading } = useQuery({
    queryKey: ['readme', data?.redame],
    queryFn: async () => {
      const url = await dwAcConst(data?.redame, game_id)
      return fetch(url.url).then((res) => res.text())
    },
    enabled: !!data?.redame,
  })

  // 下载处理函数
  const handleDownload = async (path: string, game_id: string) => {
    setDownloadingMap((prev) => ({ ...prev, [path]: true }))
    const [err, log] = await tryit(dwAcConst)(path, game_id)
    if (err) {
      toast.error('下载请求失败喵～')
    }
    if (log?.url) {
      window.open(log.url, '_blank')
      toast.success('已成功请求下载喵～')
    } else {
      toast.error('下载 URL 找不到喵～')
    }

    setDownloadingMap((prev) => ({ ...prev, [path]: false }))
  }

  // 复制处理函数
  const handleCopy = async (text: string, game_id: string) => {
    setIsCopying((prev) => ({ ...prev, [text]: true }))
    try {
      const url = await dwAcConst(text, game_id)
      await navigator.clipboard.writeText(url.url)
      toast.success('下载链接已复制喵～')
    } catch {
      toast.error('复制失败喵～')
    } finally {
      setIsCopying((prev) => ({ ...prev, [text]: false }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[85%] overflow-y-auto"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{data?.volumes ? `分卷列表` : `文件信息`}</DialogTitle>
        </DialogHeader>

        {data?.volumes ? (
          <div className="flex w-full max-w-md flex-col">
            {data.children?.map((item) => (
              <Item key={item.id} variant="outline">
                <ItemContent>
                  <ItemTitle>{item.name}</ItemTitle>
                  <ItemDescription className="ml-2">
                    {formatBytes(Number(item.size))}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="outline"
                    onClick={() => handleCopy(item?.id || '', game_id)}
                    size="icon"
                    disabled={isCopying[item?.id] || false}
                  >
                    {isCopying[item?.id] ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        ></path>
                      </svg>
                    ) : (
                      <Copy strokeWidth={1} />
                    )}
                  </Button>

                  <Button
                    onClick={() => handleDownload(item?.id, game_id)}
                    disabled={downloadingMap[item?.id] || false}
                    data-umami-event="GameDownload"
                    data-umami-event-pathe={item?.id}
                    variant="outline"
                    data-umami-event-size={item?.size}
                  >
                    {downloadingMap[item?.id] ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          ></path>
                        </svg>
                        请求中
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Download />
                        下载
                      </div>
                    )}
                  </Button>
                </ItemActions>
              </Item>
            ))}

            <DialogDescription className="ml-2 mt-1 text-center">
              <span>全部下载到一个目录中解压 part1 分卷</span>
            </DialogDescription>

            <div className="flex text-center justify-center mt-2">
              <div className="flex text-center items-center">解压密码：</div>
              <div className="relative w-19">
                <pre className="pr-6 text-center items-center rounded-md border">
                  玖辞
                </pre>
                <CopyButton
                  size="default"
                  variant="secondary"
                  content="玖辞"
                  onCopy={() => console.assert('已复制!')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <span className="flex justify-center wrap-break-word">
              <FileArchive className="w-20 h-20" strokeWidth={1} />
            </span>

            <span className="text-center wrap-break-word">{data?.name}</span>

            <DialogDescription className="ml-2 text-center">
              <span>{formatBytes(Number(data?.size))}</span>
            </DialogDescription>

            <div className="flex text-center justify-center mt-2">
              <div className="flex text-center items-center">解压密码：</div>
              <div className="relative w-19">
                <pre className="pr-6 text-center items-center rounded-md border">
                  玖辞
                </pre>
                <CopyButton
                  size="default"
                  variant="secondary"
                  content="玖辞"
                  onCopy={() => console.assert('已复制!')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-center sm:justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleCopy(data?.id || '', game_id)}
                size="icon"
                disabled={isCopying[data?.id || ''] || false}
              >
                {isCopying[data?.id || ''] ? (
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                ) : (
                  <Copy strokeWidth={1} />
                )}
              </Button>

              <Button
                onClick={() => handleDownload(data?.id || '', game_id)}
                disabled={downloadingMap[data?.id || ''] || false}
                data-umami-event="GameDownload"
                data-umami-event-pathe={data?.id}
                data-umami-event-size={data?.size}
                variant="outline"
              >
                {downloadingMap[data?.id || ''] ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      ></path>
                    </svg>
                    请求中
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <Download />
                    下载
                  </div>
                )}
              </Button>
              <Button
                onClick={() => close()}
                variant="outline"
                className="text-red-500"
              >
                关闭
              </Button>
            </DialogFooter>
          </>
        )}
        {readmedata && (
          <div className="max-h-96 overflow-y-auto p-2 border-2 rounded-2xl wrap-break-word">
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 rounded-full" />
                  ))
                : null}
            </div>
            <MarkdownAsync readmedata={readmedata} />
          </div>
        )}
        <GlgczujmDl />
      </DialogContent>
    </Dialog>
  )
}
