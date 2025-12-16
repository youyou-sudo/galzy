import type { GameModel } from '@api/modules/games/model'
import { api } from '@libs'
import { getTitles } from '@web/app/(app)/[id]/(lib)/contentDataac'
import { cacheTag } from 'next/cache'

const vltdma = {
  code: 400,
  messages: {
    notFound: '喵喵什么都不知道喵，请提供正确的游戏 ID 喵～',
    noFiles: '喵喵什么都不知道喵，此游戏没有文件喵～',
  },
  getMessage(type: 'notFound' | 'noFiles') {
    return { code: '400', message: this.messages[type] }
  },
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(request: Request) {
  const vid = new URL(request.url).searchParams.get('vid')
  if (!vid) return jsonResponse(vltdma.getMessage('notFound'), vltdma.code)
  const data = await getData(vid)
  return jsonResponse(data)
}


async function getData(vid: string) {
  "use cache"
  cacheTag(`getVnDetails-${vid}`, 'gameData-api')
  const [gameResp, fileListResp, strategyList] = await Promise.all([
    api.games.get({ query: { id: vid } }),
    api.games.openlistfiles.get({ query: { id: vid } }),
    api.strategy.gamestrategys.get({ query: { gameId: vid } }),
  ])

  if (gameResp.status >= 400)
    return jsonResponse(vltdma.getMessage('notFound'), vltdma.code)

  const datas = gameResp.data
  const titlesData = getTitles({ data: datas }).olang

  const aliasData = datas?.vn_datas?.alias
    ?.split('\n')
    .map((s) => s.trim())
    .filter((s) => s && s !== titlesData)
    .join(', ')

  const openlist = fileListResp.data as GameModel.TreeNode[]
  if (!openlist?.length)
    return jsonResponse(vltdma.getMessage('noFiles'), vltdma.code)

  return {
    code: 200,
    message: 'success',
    data: {
      vid: datas?.vn_datas?.id,
      title: titlesData,
      alias: aliasData,
      description: datas?.vn_datas?.description,
      filelist: groupSplitArchives(openlist[0].children),
      strategy: strategyList.data?.map(({ author, user, ...rest }) => ({
        ...rest,
        user: {
          id: user!.id,
          name: user!.name,
          image: user!.image,
        },
      })),
    },
  }
}

export function groupSplitArchives(
  items: GameModel.TreeNode[] | undefined,
): GameModel.TreeNode[] | undefined {
  if (!items || items.length === 0) return items

  const mdMap = new Map<string, string>()
  const archivesMap = new Map<string, GameModel.TreeNode[]>()
  const others: GameModel.TreeNode[] = []
  const splitRegex = /(.*?)(?:\.part\d+)\.(rar|zip|7z)$/i
  const timestamp = Date.now()

  items.forEach((item) => {
    if (item.type === 'folder') {
      if (!item.name.startsWith('(分卷) ')) {
        item.children = groupSplitArchives(item.children ?? [])
      }
      others.push(item)
      return
    }

    if (item.name.endsWith('.md')) {
      mdMap.set(item.name.replace(/\.md$/i, ''), item.id)
      return
    }

    const match = item.name.match(splitRegex)
    const nameWithoutExt = item.name.replace(/\.[^/.]+$/, '')
    if (mdMap.has(nameWithoutExt)) item.redame = mdMap.get(nameWithoutExt)

    if (match) {
      const key = `${match[1]}.${match[2]}`
      if (!archivesMap.has(key)) archivesMap.set(key, [])
      archivesMap.get(key)!.push(item)
    } else {
      others.push(item)
    }
  })

  const archiveFolders = Array.from(archivesMap.entries()).map(
    ([fullName, files]) => ({
      id: `archive-${fullName}-${timestamp}`,
      type: 'folder' as const,
      name: `(分卷) ${fullName}`,
      children: files,
    }),
  )

  return [...others, ...archiveFolders]
}
