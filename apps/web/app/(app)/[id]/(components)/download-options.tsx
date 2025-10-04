'use client'

import { useQuery } from '@tanstack/react-query'
import {
  File,
  Files,
  Folder,
} from '@web/components/animate-ui/components/files'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@web/components/ui/dialog"
import { Button } from '@web/components/ui/button'
import { CopyButton } from '@web/components/ui/shadcn-io/copy-button'
import { Skeleton } from '@web/components/ui/skeleton'
import type { getFileList } from '@web/lib/repositories/alistFileList'
import { Download } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import Markdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { MarkdownComponents } from './markdown-components'
import { downCardDataStore } from './stores/downCardData'
import type { GameModel } from '@api/modules/games/model'


export function DownloadOptions({ fileList }: { fileList: GameModel.TreeNode[] }) {
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
        item.type === 'folder' ? (
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

  // Size 转换
  function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 字节'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['字节', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

useEffect(() => {
  if (!isOpen) return

  const handleHashChange = () => {
    if (!location.hash.includes('modal')) {
      close()
    }
  }

  const prevHash = location.hash
  location.hash = 'modal'

  window.addEventListener('hashchange', handleHashChange)

  return () => {
    window.removeEventListener('hashchange', handleHashChange)
    if (location.hash === '#modal') {
      history.replaceState(null, '', prevHash || ' ')
    }
  }
}, [isOpen, close])

  const { data: readmedata, isLoading } = useQuery({
    queryKey: ['readme', data?.redame],
    queryFn: () =>
      fetch(`/api/download?path=${data?.redame}`).then((res) => res.text()),
    enabled: !!data?.redame,
  })

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[85%]"
        // 🔥 阻止 Radix 自动 focus 恢复，避免关闭时卡住
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>文件信息</DialogTitle>
        </DialogHeader>
        <span className="text-center text-lg break-words">{data?.name}</span>
        <DialogDescription className="text-center">
          <span>{formatBytes(Number(data?.size))}</span>
        </DialogDescription>

        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button
            onClick={() => close()}
            variant="secondary"
            className="text-red-500"
          >
            关闭
          </Button>
          <Button asChild>
            <Link
              prefetch={false}
              data-umami-event="GameDownload"
              data-umami-event-pathe={data?.id}
              data-umami-event-size={data?.size}
              target="_blank"
              href={`/api/download?path=${data?.id}`}
            >
              <div className="flex items-center">
                <Download />
                下载
              </div>
            </Link>
          </Button>
        </DialogFooter>

        <div className="flex text-center justify-center mt-2">
          <div className="flex text-center items-center">解压密码：</div>
          <div className="relative w-19">
            <pre className="pr-6 text-center items-center rounded-md border-1">
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

        {/* Card 内部滚动示例 */}
        {readmedata && (
          <div className="max-h-96 overflow-y-auto p-2 border-2 rounded-2xl break-words">
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[20px] rounded-full" />
                ))
                : null}
            </div>
            <div>
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={MarkdownComponents}
              >
                {readmedata}
              </Markdown>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
