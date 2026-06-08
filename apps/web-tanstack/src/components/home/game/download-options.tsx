import type { GameModel } from '@api/modules/games/model'
import { useQuery } from '@tanstack/react-query'
import { Await, getRouteApi } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import {
  FileItem,
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
  SubFiles,
} from '@web/components/animate-ui/components/radix/files'
import { Copy } from '@web/components/animate-ui/icons/copy'
import { Download } from '@web/components/animate-ui/icons/download'
import { AnimateIcon } from '@web/components/animate-ui/icons/icon'
import { MarkdownAsync } from '@web/components/markdownAync'
import { CopyButton } from '@web/components/shadcn-io/copy-button'
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
import { Skeleton } from '@web/components/ui/skeleton'
import { dwAcConst } from '@web/server/game'
import { downCardStore, downmodalActions } from '@web/stores/downCardData'
import { FileArchive } from 'lucide-react'
import { tryit } from 'radash'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { GlgczujmDl } from './tips'

const apiroute = getRouteApi('/$id/_layout/')

export const DownloadOptions = () => {
  const { filelist } = apiroute.useLoaderData()
  return (
    <>
      <Await
        promise={filelist}
        fallback={
          <>
            <Skeleton className="w-[50%] h-7" />
            <Skeleton className="w-[70%] h-7 mt-2" />
            <Skeleton className="w-full h-7 mt-2" />
          </>
        }
      >
        {(items) => {
          if (!items.game) return <div>没有找到文件列表喵～</div>
          return <FileExplorer items={items.game} />
        }}
      </Await>
      <DownCardDialog />
    </>
  )
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

        // // 检查同名 md 文件
        // if (mdMap[baseName]) {
        //   item.redame = mdMap[baseName]
        // }

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
    ([fullName, files]) => {
      const baseName = fullName.replace(/\.(rar|zip|7z)$/i, '')

      return {
        id: `archive-${fullName}-${Date.now()}`,
        redame: mdMap[baseName],
        type: 'folder' as const,
        name: `(分卷) ${fullName}`,
        volumes: true,
        children: files!,
      }
    },
  )

  return [...others, ...archiveFolders]
}

// ---------- 文件浏览器组件 ----------
const FileExplorer = ({ items }: { items: GameModel.TreeNode[] }) => {
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

  const renderTree = (nodes: GameModel.TreeNode[]): React.ReactNode => {
    return nodes.map((item) => {
      if (item.type === 'folder' && !item.volumes) {
        return (
          <FolderItem value={item.name} key={item.id}>
            <FolderTrigger>{item.name}</FolderTrigger>
            {item.children?.length ? (
              <FolderContent>
                <SubFiles>{renderTree(item.children)}</SubFiles>
              </FolderContent>
            ) : null}
          </FolderItem>
        )
      }
      return (
        <FileItem
          key={item.id}
          onClick={() => {
            downmodalActions.open(item)
          }}
        >
          {item.name}
        </FileItem>
      )
    })
  }

  return <Files>{renderTree(simplifiedItems || [])}</Files>
}

// ---------- 下载弹窗 ----------
export const DownCardDialog = () => {
  const data = useSelector(downCardStore, (s) => s.data)
  const open = useSelector(downCardStore, (s) => s.open)

  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>(
    {},
  )
  const [isCopying, setIsCopying] = useState<Record<string, boolean>>({})

  const { id: game_id } = apiroute.useParams()
  // 下载 README
  const { data: readmedata } = useQuery({
    queryKey: ['readme', data?.redame, game_id],
    queryFn: async () => {
      const url = await dwAcConst({ data: { path: data?.redame, game_id } })
      return fetch(url!.raw_url).then((res) => res.text())
    },
    enabled: !!data?.redame,
    gcTime: 1000 * 60 * 5,
    staleTime: 1000 * 60 * 10,
  })

  // 对话框关闭时清理状态
  useEffect(() => {
    if (!open) {
      setDownloadingMap({})
      setIsCopying({})
    }
  }, [open])

  const [mdReady, setMdReady] = useState(false)
  useEffect(() => {
    setMdReady(false)
  }, [])
  // 下载处理函数
  const handleDownload = async (path: string, game_id: string) => {
    setDownloadingMap((prev) => ({ ...prev, [path]: true }))
    const [err, log] = await tryit(dwAcConst)({ data: { path, game_id } })
    if (err) {
      toast.error('下载请求失败喵～')
    }
    if (log?.raw_url) {
      window.open(log.raw_url, '_blank')
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
      const url = await dwAcConst({ data: { path: text, game_id } })
      await navigator.clipboard.writeText(url!.raw_url)
      toast.success('下载链接已复制喵～')
    } catch {
      toast.error('复制失败喵～')
    } finally {
      setIsCopying((prev) => ({ ...prev, [text]: false }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={downmodalActions.setOpen}>
      <DialogContent
        className="max-h-[85%] overflow-y-auto"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{data?.volumes ? `分卷列表` : `文件信息`}</DialogTitle>
        </DialogHeader>

        {data?.volumes ? (
          <div className="flex w-full max-w-md flex-col">
            {data.children?.map((item: any) => (
              <Item key={item.id} variant="outline">
                <ItemContent>
                  <ItemTitle>{item.name}</ItemTitle>
                  <ItemDescription className="ml-2">
                    {item.size}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <AnimateIcon animateOnHover>
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
                        <Copy />
                      )}
                    </Button>
                  </AnimateIcon>
                  <AnimateIcon animateOnHover>
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
                  </AnimateIcon>
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
                  onCopy={() => console.assert(true, '已复制!')}
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
              <span>{data?.size || `未知大小`}</span>
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
                  onCopy={() => console.assert(true, '已复制!')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                />
              </div>
            </div>

            <DialogFooter className="flex-row justify-center sm:justify-center gap-2">
              <AnimateIcon animateOnHover>
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
                    <Copy />
                  )}
                </Button>
              </AnimateIcon>
              <AnimateIcon animateOnHover>
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
              </AnimateIcon>
              <Button
                onClick={() => downmodalActions.close()}
                variant="outline"
                className="text-red-500"
              >
                关闭
              </Button>
            </DialogFooter>
          </>
        )}
        {data?.redame && (
          <div className="max-h-96 overflow-y-auto p-2 border-2 rounded-2xl wrap-break-word">
            {!mdReady && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 rounded-full" />
                ))}
              </div>
            )}

            {readmedata && (
              <MarkdownAsync
                readmedata={readmedata}
                onReady={() => setMdReady(true)}
              />
            )}
          </div>
        )}
        <GlgczujmDl />
      </DialogContent>
    </Dialog>
  )
}
