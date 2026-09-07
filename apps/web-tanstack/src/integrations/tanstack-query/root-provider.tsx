import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  persistQueryClient,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

const defaultOptions = {
  queries: {
    gcTime: 60_000,
    staleTime: 30_000,
  },
} as const

/**
 * 持久化白名单：仅公开 GET 数据，用户相关（auth/session）与后台管理数据不持久化。
 * 命中 localStorage 后 F5/重新打开秒出缓存再后台刷新，体验接近原生 APP。
 * tagCategories 数据量大且访问低频，不持久化以防撑爆 localStorage。
 */
const PERSIST_PREFIXES = new Set([
  'gameDetail',
  'gameTags',
  'gameList',
  'homeCollections',
  'totalCount',
  'hotGames',
  'topics',
  'topic',
  'comments',
  'searchTags',
])

/** 持久化缓存最长保留 30 分钟，超时自动清理 */
const PERSIST_MAX_AGE = 30 * 60 * 1000

function shouldPersistQuery(query: { queryKey: readonly unknown[] }) {
  return PERSIST_PREFIXES.has(String(query.queryKey[0]))
}

/**
 * gameList 列表项裁剪：只保留渲染卡片必需的字段。
 * Meili 文档含 description/releases/tags_obj/otherData 等大字段，
 * 全量进 localStorage 会让每次 persist 都在主线程做 MB 级 JSON 序列化
 * + 同步写 —— 加载多页后点击/返回的卡顿来源之一。
 * 裁剪后 hydration 仍能秒出首屏；详情页走 gameDetail 查询，不受影响。
 */
function pickGameListImage(image: unknown) {
  if (!image || typeof image !== 'object') return image
  const img = image as Record<string, unknown>
  return {
    width: img.width,
    height: img.height,
    thumbhash: img.thumbhash,
    imageUrl: img.imageUrl,
    c_sexual_avg: img.c_sexual_avg,
  }
}

function slimGameListPage(page: unknown) {
  if (!page || typeof page !== 'object') return page
  const p = page as { items?: unknown } & Record<string, unknown>
  if (!Array.isArray(p.items)) return page
  return {
    ...p,
    // facetDistribution 等聚合字段列表页未使用，直接丢弃
    facetDistribution: undefined,
    items: p.items.map((item) => {
      if (!item || typeof item !== 'object') return item
      const it = item as Record<string, unknown>
      return {
        id: it.id,
        olang: it.olang,
        titles_obj: it.titles_obj,
        images: pickGameListImage(it.images),
      }
    }),
  }
}

/** gameList 最多持久化前 N 页：F5 秒出首屏，超出页 refetch 一次即可 */
const PERSIST_GAME_LIST_PAGES = 5

function slimGameListState(state: unknown) {
  if (!state || typeof state !== 'object') return state
  const s = state as { pages?: unknown[]; pageParams?: unknown[] } & Record<
    string,
    unknown
  >
  if (!Array.isArray(s.pages)) return state
  return {
    ...s,
    pages: s.pages.slice(0, PERSIST_GAME_LIST_PAGES).map(slimGameListPage),
    pageParams: Array.isArray(s.pageParams)
      ? s.pageParams.slice(0, PERSIST_GAME_LIST_PAGES)
      : s.pageParams,
  }
}

function slimClientForPersist(client: PersistedClient): PersistedClient {
  const queries = client.clientState.queries.map((query) => {
    if (String(query.queryKey[0]) !== 'gameList') return query
    return { ...query, state: slimGameListState(query.state) as typeof query.state }
  })
  return { ...client, clientState: { ...client.clientState, queries } }
}

/**
 * 整包快照式 localStorage Persister（v5 移除了 createSyncStoragePersister，
 * 这里按 Persister 接口手写等价实现：单 key 存整个 clientState 快照）。
 * - gameList 先裁剪再序列化（体积从 MB 级降到 KB 级）
 * - requestIdleCallback 空闲合并写：点击/返回的关键路径不被同步写阻塞
 * - QuotaExceeded 降级：清旧 key，避免异常影响应用
 */
function createLocalStoragePersister({
  key,
  storage,
}: {
  key: string
  storage: Storage
}): Persister {
  let pending: PersistedClient | null = null
  let scheduled = false

  const flush = () => {
    scheduled = false
    if (!pending) return
    const client = pending
    pending = null
    try {
      storage.setItem(key, JSON.stringify(slimClientForPersist(client)))
    } catch {
      try {
        storage.removeItem(key)
        storage.setItem(key, JSON.stringify(slimClientForPersist(client)))
      } catch {
        // 存储不可用/配额不足：放弃本次持久化，不影响应用运行
      }
    }
  }

  return {
    async persistClient(client) {
      pending = client as PersistedClient
      if (scheduled) return
      scheduled = true
      if (
        typeof requestIdleCallback === 'function' &&
        typeof cancelIdleCallback === 'function'
      ) {
        requestIdleCallback(flush, { timeout: 2000 })
      } else {
        setTimeout(flush, 0)
      }
    },
    async restoreClient() {
      const value = storage.getItem(key)
      if (!value) return undefined
      try {
        return JSON.parse(value)
      } catch {
        // 损坏数据交给调用方 removeClient 清理
        return undefined
      }
    },
    async removeClient() {
      storage.removeItem(key)
    },
  }
}

export function getContext() {
  const queryClient = new QueryClient({ defaultOptions })

  // gameList 内存缓存保留更久：详情页停留超默认 60s gc 后返回不再 refetch。
  // localStorage 持久化不受 gcTime 影响（maxAge 30min），F5 秒开能力保留。
  queryClient.setQueryDefaults(['gameList'], { gcTime: 10 * 60_000 })

  // 仅客户端：把公开查询缓存持久化到 localStorage 并在启动时恢复。
  // 恢复采用 hydrate() 语义——SSR 新数据（dataUpdatedAt 更新）永远优先于本地缓存，
  // 不存在旧缓存覆盖 SSR 首屏的问题；buster 绑定构建版本，发版后自动清库。
  if (typeof window !== 'undefined') {
    const persister = createLocalStoragePersister({
      key: 'galzy:query-cache',
      storage: window.localStorage,
    })
    const [unsubscribe, restorePromise] = persistQueryClient({
      queryClient,
      persister,
      maxAge: PERSIST_MAX_AGE,
      buster: (window as { __BUILD_ID__?: string }).__BUILD_ID__ ?? '',
      dehydrateOptions: {
        shouldDehydrateQuery: shouldPersistQuery,
      },
    })
    // 恢复失败（如持久化数据损坏）时丢弃缓存，不让异常影响应用启动
    restorePromise.catch(() => unsubscribe())
  }

  return { queryClient }
}

export default function TanStackQueryProvider({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()
  const { queryClient } = router.options.context as {
    queryClient: QueryClient
  }

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}