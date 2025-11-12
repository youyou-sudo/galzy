import type { GameModel } from '@api/modules/games/model'
import { api } from '@libs'
import { getTitles } from '@web/app/(app)/[id]/(lib)/contentDataac'

const vltdma = {
  code: 400,
  getMessage(type: 'notFound' | 'noFiles') {
    const messages = {
      notFound: {
        message: '喵喵什么都不知道喵，请提供正确的游戏 ID 喵～',
        code: '400',
      },
      noFiles: {
        message: '喵喵什么都不知道喵，请提供正确的游戏 ID 喵～',
        code: '400',
      },
    }
    return messages[type]
  },
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const vid = searchParams.get('vid')

  if (!vid) {
    return new Response(JSON.stringify(vltdma.getMessage('notFound')), {
      status: vltdma.code,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [gameResp, fileListResp, strategyList] = await Promise.all([
    api.games.get({ query: { id: vid } }),
    api.games.openlistfiles.get({ query: { id: vid } }),
    api.strategy.gamestrategys.get({ query: { gameId: vid } }),
  ])

  if (gameResp.status >= 400) {
    return new Response(JSON.stringify(vltdma.getMessage('notFound')), {
      status: vltdma.code,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const datas = gameResp.data
  const titlesData = getTitles({ data: datas }).olang

  const aliasData = datas?.vn_datas?.alias
    ?.split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== titlesData)
    .join(', ')

  const openlist = fileListResp.data as GameModel.TreeNode[]
  if (!openlist?.length) {
    return new Response(JSON.stringify(vltdma.getMessage('noFiles')), {
      status: vltdma.code,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const res = {
    code: 200,
    message: 'success',
    data: {
      vid: datas?.vn_datas?.id,
      title: titlesData,
      alias: aliasData,
      description: datas?.vn_datas?.description,
      filelist: groupSplitArchives(openlist[0].children),
      strategy: strategyList.data,
    },
  }
  return Response.json(res)
}

// ---------- 分卷文件识别处理 + md 同名判定 ----------
export function groupSplitArchives(
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
