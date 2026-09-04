import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  persistQueryClient,
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
 * 整包快照式 localStorage Persister（v5 移除了 createSyncStoragePersister，
 * 这里按 Persister 接口手写等价实现：单 key 存整个 clientState 快照）。
 */
function createLocalStoragePersister({
  key,
  storage,
}: {
  key: string
  storage: Storage
}): Persister {
  return {
    async persistClient(client) {
      storage.setItem(key, JSON.stringify(client))
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