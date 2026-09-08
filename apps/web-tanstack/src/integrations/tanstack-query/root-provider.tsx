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

/**
 * gameDetail 详情裁剪：只保留详情页首屏恢复必需的字段。
 * API（apps/api games.get）返回的大体积字段：
 * - vn.releasesVn：完整 release 行 join 数组，UI 完全未消费（下载 tab 走独立的 filelist 查询）
 * - otherData.other_media：媒体表 join 大数组，UI 完全未消费
 * 这两者是详情快照体积的大头，直接裁掉。
 * vn.description / otherData.description 是详情页首屏简介预览（GameInfo）与
 * meta description 的数据源，裁掉会让恢复瞬间简介消失（破相），故保留。
 * vn.image 裁剪为渲染所需字段（封面 URL/尺寸/thumbhash/分级），用于恢复瞬间封面「飞入」。
 */
function pickGameDetailImage(image: unknown) {
  if (!image || typeof image !== 'object') return image
  const img = image as Record<string, unknown>
  return {
    id: img.id,
    url: img.url,
    imageUrl: img.imageUrl,
    width: img.width,
    height: img.height,
    thumbhash: img.thumbhash,
    cSexualAvg: img.cSexualAvg,
  }
}

function slimGameDetailData(data: unknown) {
  if (!data || typeof data !== 'object') return data
  const d = data as { vn?: unknown; otherData?: unknown } & Record<
    string,
    unknown
  >
  return {
    ...d,
    vn: slimGameDetailVn(d.vn),
    otherData: slimGameDetailOtherData(d.otherData),
  }
}

function slimGameDetailVn(vn: unknown) {
  if (!vn || typeof vn !== 'object') return vn
  const v = vn as { releasesVn?: unknown; image?: unknown } & Record<
    string,
    unknown
  >
  return {
    ...v,
    // 完整 release 行数组，UI 未消费；description/titles/alias 等首屏字段保留
    releasesVn: undefined,
    image: pickGameDetailImage(v.image),
  }
}

function slimGameDetailOtherData(otherData: unknown) {
  if (!otherData || typeof otherData !== 'object') return otherData
  // other_media 为媒体 join 大数组，UI 未消费；description/title/alias 等保留
  const o = otherData as { other_media?: unknown } & Record<string, unknown>
  return {
    ...o,
    other_media: undefined,
  }
}

function slimGameDetailState(state: unknown) {
  if (!state || typeof state !== 'object') return state
  const s = state as { data?: unknown } & Record<string, unknown>
  if (!('data' in s)) return state
  return { ...s, data: slimGameDetailData(s.data) }
}

function slimClientForPersist(client: PersistedClient): PersistedClient {
  const queries = client.clientState.queries.map((query) => {
    const key = String(query.queryKey[0])
    if (key === 'gameList') {
      return { ...query, state: slimGameListState(query.state) as typeof query.state }
    }
    if (key === 'gameDetail') {
      return { ...query, state: slimGameDetailState(query.state) as typeof query.state }
    }
    return query
  })
  return { ...client, clientState: { ...client.clientState, queries } }
}

/** VT 动画约 250ms，每次让位后间隔 300ms 再探测，最多重试 3 次后强制写入 */
const VT_RETRY_DELAY_MS = 300
const VT_MAX_RETRIES = 3

/**
 * 探测 View Transition 是否正在播放。
 * Router 在所有 loader resolve 后调用 document.startViewTransition（src/lib/view-transition.ts
 * 已 monkey-patch），root 伪元素树上会出现 ::view-transition 运行动画；
 * document.getAnimations() 能枚举到它们（effect.pseudoElement 以 ::view-transition 开头）。
 */
function isViewTransitionActive(): boolean {
  try {
    return document
      .getAnimations()
      .some(
        (anim) =>
          anim.effect instanceof KeyframeEffect &&
          (anim.effect.pseudoElement ?? '').startsWith('::view-transition'),
      )
  } catch {
    return false
  }
}

/**
 * 整包快照式 localStorage Persister（v5 移除了 createSyncStoragePersister，
 * 这里按 Persister 接口手写等价实现：单 key 存整个 clientState 快照）。
 * - gameList / gameDetail 先裁剪再序列化（体积从 MB 级降到 KB 级）
 * - requestIdleCallback 空闲合并写（timeout 5s）：点击/返回的关键路径不被同步写阻塞，
 *   且 flush 会避让 View Transition 动画窗口
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

  /**
   * flush 排程（带 VT 避让）。
   * 因果：首次进入详情页时 gameDetail 查询刚成功 → persistQueryClient 订阅触发 persistClient
   * → rIC 恰好在 250ms VT 动画期间主线程空闲时 fire，flush 的 JSON.stringify + 同步
   * localStorage.setItem 长任务落在动画窗口内，造成掉帧。故 flush 执行前探测
   * ::view-transition 运行动画，仍在播放则让位 300ms 后重新排队；最多重试 3 次，
   * 之后强制执行以免写入被持续动画饿死。
   */
  const scheduleFlush = (attempt: number) => {
    const run = () => {
      if (isViewTransitionActive() && attempt < VT_MAX_RETRIES) {
        setTimeout(() => scheduleFlush(attempt + 1), VT_RETRY_DELAY_MS)
        return
      }
      flush()
    }
    if (
      typeof requestIdleCallback === 'function' &&
      typeof cancelIdleCallback === 'function'
    ) {
      requestIdleCallback(run, { timeout: 5000 })
    } else {
      setTimeout(run, 0)
    }
  }

  return {
    async persistClient(client) {
      pending = client as PersistedClient
      if (scheduled) return
      scheduled = true
      scheduleFlush(0)
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