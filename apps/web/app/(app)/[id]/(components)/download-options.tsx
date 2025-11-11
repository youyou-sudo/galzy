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
import { Skeleton } from '@web/components/ui/skeleton'
import { Check, Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { downCardDataStore } from './stores/downCardData'
import type { GameModel } from '@api/modules/games/model'
import { dwAcConst } from '@web/lib/download/ac'
import { CopyButton } from '@web/components/ui/shadcn-io/copy-button'
import { MarkdownAsync } from '@web/components/markdownAync'
import dynamic from 'next/dynamic'



export function CopyButtons({ id }: { id?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (id) {
      const url = `${window.location.origin}/api/download?path=${id}`;
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000); // 3秒后恢复图标
        })
        .catch(() => {
          alert("复制失败，请手动复制链接。");
        });
    }
  };

  return (
    <Button onClick={handleCopy} variant="outline" className="flex items-center space-x-1">
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      <span>复制链接</span>
    </Button>
  );
}

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

  const [isDownloading, setIsDownloading] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

  // 文件大小格式化
  function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 字节'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['字节', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  // 下载 README
  const { data: readmedata, isLoading } = useQuery({
    queryKey: ['readme', data?.redame],
    queryFn: async () => {
      const url = await dwAcConst(data?.redame)
      return fetch(url.url).then((res) => res.text())
    },
    enabled: !!data?.redame,
  })

  // 下载处理函数
  const handleDownload = async () => {
    if (!data?.id) return
    setIsDownloading(true)
    try {
      const log = await dwAcConst(data.id)
      if (log?.url) {
        window.open(log.url, '_blank');
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsDownloading(false)
    }
  }

  // 复制处理函数
  const handleCopy = async (text: string) => {
    setIsCopying(true)
    try {
      const url = await dwAcConst(text)
      await navigator.clipboard.writeText(url.url)
      alert('已复制！')
    } catch {
      alert('复制失败，请手动复制')
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[85%]"
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

          <Button
            variant="outline"
            onClick={() => handleCopy(data?.id || '')}
            disabled={isCopying}
          >
            {isCopying ? '请求中...' : '复制链接'}
          </Button>

          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            data-umami-event="GameDownload"
            data-umami-event-pathe={data?.id}
            data-umami-event-size={data?.size}
          >
            {isDownloading ? (
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

        {readmedata && (
          <div className="max-h-96 overflow-y-auto p-2 border-2 rounded-2xl break-words">
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[20px] rounded-full" />
                ))
                : null}
            </div>
            <MarkdownAsync readmedata={readmedata} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

