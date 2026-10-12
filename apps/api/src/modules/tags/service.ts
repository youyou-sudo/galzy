import {
  alistb,
  buildCoverUrl,
  db,
  hasUsablePortraitCover,
  images,
  kungalWorks,
  media,
  otherMedia,
  others,
  tags,
  tagsRelations,
  tagsVn,
  transformStoredUrl,
  vn,
  vnTitles,
  zhtags,
} from '@api/libs'
import { purgeByTags, purgeTagPages } from '@api/libs/cloudflare-cache'
import { delKv, delKvPattern, getKv, setKv } from '@api/libs/redis'
import { getEffectiveWeekStart, getMonthStart } from '@api/libs/time-window'
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  like,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { status } from 'elysia'
import type { TagsModel } from './model'

/**
 * 标签层级是 DAG（VNDB 中 530 个标签有多个父标签），但实测无环，
 * 因此递归 CTE 是安全的。用 UNION 而非 UNION ALL 做幂等去重，兼作环保护。
 *
 * 只用于取后代：祖先方向不能这么走，见 getTagAncestorPaths 的说明。
 *
 * @returns id + 最短路径深度，按 depth 升序（直接子标签在前）。
 */
async function getTagDescendantIds(
  tagId: string,
): Promise<Array<{ id: string; depth: number }>> {
  // 层级边只有约 3600 行，递归本身很便宜，但 detail/taggames 每次请求都会走到这。
  // 根标签扇出很大（g1 Theme 有 1399 个后代），缓存解析结果避免重复递归。
  //
  // 注意失效依赖：层级只在官方 tag dump 同步时变化，所有写层级的路径都必须清掉
  // galzy:tags:rel:*。目前有两条 —— syncTagHierarchy() 与 purgeAfterSync()，
  // 两者都执行 delKvPattern('galzy:tags:*')。若将来新增写入层级的路径，
  // 必须同步补上失效，否则本缓存最长会滞留 24h（而依赖它的 tag / tagGames
  // 缓存只有 1h，它们的正确性也一并建立在这两个失效调用之上）。
  const cacheKey = `galzy:tags:rel:v2:down:${tagId}`
  const cached = await getKv(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as Array<{ id: string; depth: number }>
    } catch {
      await delKv(cacheKey)
    }
  }

  // 向下：parent -> child（列名直接写在 SQL 里，不做动态拼接）
  const rows = await db.execute(sql`
    WITH RECURSIVE walk(id, depth) AS (
      SELECT child, 1 FROM ${tagsRelations} WHERE parent = ${tagId}
      UNION
      SELECT r.child, w.depth + 1
      FROM ${tagsRelations} r
      INNER JOIN walk w ON r.parent = w.id
      -- 环保护：VNDB 标签层级实测无环（最大深度 7），一旦 dump 出现环，
      -- UNION 会因 depth 递增而无限递归。深度上限远大于真实最大值，不会截断正常层级。
      WHERE w.depth < 64
    )
    SELECT id, MIN(depth)::int AS depth
    FROM walk
    GROUP BY id
    ORDER BY MIN(depth) ASC, id
  `)
  const result = rows as Array<{ id: string; depth: number }>
  void setKv(cacheKey, JSON.stringify(result), 60 * 60 * 24)
  return result
}

/**
 * 取标签到根的全部祖先路径，每条路径按「根 → … → 直接父级」返回。
 *
 * VNDB 的层级是 DAG 而非树：530 个标签有多个父标签，因此一个标签往往有多条
 * 到根的路径（g513 Netorare 同时挂在 Jealousy 与 Sex with Others 之下，
 * 两条链一直到「Theme」才汇合）。面包屑必须逐条展示——把不同分支的节点合并成
 * 一条线会渲染出「Drama > Sexual Content > …」这类根本不存在的路径（旧实现
 * 取 MIN(depth) 后按深度排序，正是这个效果）。
 *
 * 实测：最大深度 7，单个标签最多 7 条路径（g2962），全库共 4076 条到根的路径，
 * 量级很小。环保护用「当前路径内不重复」而非 UNION 去重——按路径去重才能保留
 * 同一节点的多条分支，而深度上限只是兜底。
 */
async function getTagAncestorPaths(tagId: string): Promise<string[][]> {
  // 失效依赖与 getTagDescendantIds 相同（层级只在 tag dump 同步时变化，
  // syncTagHierarchy / purgeAfterSync 都会 delKvPattern('galzy:tags:*')）。
  // 前缀故意选 galzy:tags: 而不是 galzy:tag:，好被那条 pattern 覆盖到。
  const cacheKey = `galzy:tags:paths:v1:${tagId}`
  const cached = await getKv(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as string[][]
    } catch {
      await delKv(cacheKey)
    }
  }

  const rows = await db.execute(sql`
    WITH RECURSIVE up(id, path, depth) AS (
      SELECT r.parent, ARRAY[r.parent], 1
      FROM ${tagsRelations} r
      WHERE r.child = ${tagId}
      UNION ALL
      SELECT rr.parent, u.path || rr.parent, u.depth + 1
      FROM up u
      INNER JOIN ${tagsRelations} rr ON rr.child = u.id
      -- 环保护：同一路径内不重复，且深度不超过 64（真实最大 7）
      WHERE u.depth < 64 AND NOT (rr.parent = ANY(u.path))
    )
    SELECT path
    FROM up
    -- 只保留终点：自身没有父标签的才是根
    WHERE NOT EXISTS (
      SELECT 1 FROM ${tagsRelations} p WHERE p.child = up.id
    )
  `)

  const paths = (rows as Array<{ path: string[] }>)
    // CTE 累积的是「父 → … → 根」，反转成「根 → … → 父」
    .map((r) => [...r.path].reverse())
    // 排序只为稳定输出（同一标签每次拿到的顺序一致，便于缓存与快照对比）
    .sort((a, b) => a.join(',').localeCompare(b.join(',')))

  void setKv(cacheKey, JSON.stringify(paths), 60 * 60 * 24)
  return paths
}

/**
 * 批量取标签的英文名 + 中文名，用于子标签列表。
 *
 * 按 depth 升序（直接子标签在前）。
 *
 * 只返回已本地化（zhtags 存在）的标签：层级同步会写入 dump 中全部标签，
 * 而 Tags.tag 用 innerJoin(zhtags) 查询，未本地化的标签点进去必然 404。
 */
async function fetchTagLabels(related: Array<{ id: string; depth: number }>) {
  if (related.length === 0) return []
  const depthMap = new Map(related.map((r) => [r.id, r.depth]))
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      zht_name: zhtags.name,
    })
    .from(tags)
    .innerJoin(zhtags, eq(tags.id, zhtags.id))
    .where(
      inArray(
        tags.id,
        related.map((r) => r.id),
      ),
    )
  return rows
    .map((r) => ({ ...r, depth: depthMap.get(r.id) ?? 0 }))
    .sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
}

/**
 * 批量取标签名（英文 + 中文），供祖先路径使用。
 *
 * 与 fetchTagLabels 的区别是「不过滤未本地化标签」：祖先路径是一条完整链路，
 * 中间节点被剔除会让链路断开甚至错位，因此这里保留全部节点，由前端把缺少
 * 中文名的节点渲染成不可点击的纯文本（点进去必然 404）。
 * 与 tags / tags_relations 一样，是 LEFT JOIN 而不是 INNER JOIN。
 */
async function fetchTagLabelMap(ids: string[]) {
  const map = new Map<
    string,
    { id: string; name: string | null; zht_name: string | null }
  >()
  if (ids.length === 0) return map
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      zht_name: zhtags.name,
    })
    .from(tags)
    .leftJoin(zhtags, eq(tags.id, zhtags.id))
    .where(inArray(tags.id, ids))
  for (const r of rows) map.set(r.id, r)
  return map
}

/**
 * 去掉 VNDB 描述里的 BBCode 风格标记，转成可直接展示的纯文本。
 *
 * dump/Kuna API 的 description 使用 `[url=...]文字[/url]`、`[spoiler]` 这类标记，
 * 直接渲染会出现 `[url=...]` 之类的噪声。这里只做保守处理：
 * - `[url=X]文字[/url]` → 文字（丢弃链接，站内展示不需要外链）
 * - 其余成对/自闭合标记直接去除
 * 本地化的 zhtags.description 是人工撰写的纯文本，不做处理。
 */
function stripVndbMarkup(text: string): string {
  return text
    .replace(/\[url=[^\]]*\]([\s\S]*?)\[\/url\]/g, '$1')
    .replace(/\[\/?[a-z][^\]]*\]/gi, '')
    .trim()
}

/**
 * 每个标签在「站内收录」口径下的游戏数（tags_vn ⋈ galrc_alistb，count(DISTINCT vid)）。
 *
 * tagHub 与 tagCategories 原本各自跑一次同样的全量聚合（实测 96ms），同一小时里
 * 因为缓存 key 不同会重复算。抽成带缓存的共享 helper，两边共用一份结果。
 *
 * 失效依赖：key 在 `galzy:tags:*` 命名空间下，层级/本地化同步的
 * delKvPattern('galzy:tags:*') 会一并清掉（见 syncTagHierarchy / purgeAfterSync）。
 */
async function getTagGameCountMap(): Promise<Map<string, number>> {
  const cacheKey = 'galzy:tags:gamecount:v1'
  const cached = await getKv(cacheKey)
  if (cached) {
    try {
      return new Map(JSON.parse(cached) as Array<[string, number]>)
    } catch {
      await delKv(cacheKey)
    }
  }
  const rows = (await db.execute(
    sql`SELECT tv.tag, count(DISTINCT tv.vid)::int AS cnt FROM tags_vn tv INNER JOIN galrc_alistb a ON a.vid = tv.vid GROUP BY tv.tag`,
  )) as Array<{ tag: string; cnt: number }>
  const map = new Map(rows.map((r) => [r.tag, r.cnt]))
  void setKv(cacheKey, JSON.stringify([...map]), 60 * 60)
  return map
}

/**
 * 每个标签的终身累计浏览量。
 *
 * 累计值 = 已 rollup 进 galrc_stat_counters 的历史部分 + 明细表剩余行
 * （明细行按 EVENT_VIEW_RETENTION_DAYS 被 TTL 清理前会先 rollup，见
 * modules/tasks/service.ts 的 rollupAndPruneEventViews 与 libs/stats.ts）。
 *
 * 这句聚合实测 237ms（要在约 250 万行 tag_view 分区上做全量 GROUP BY），是全站
 * 最贵的单条读查询之一，因此必须缓存：原实现由 tagHub / tagCategories 各跑一遍。
 */
async function getTagViewCountMap(): Promise<Map<string, number>> {
  const cacheKey = 'galzy:tags:viewcount:v1'
  const cached = await getKv(cacheKey)
  if (cached) {
    try {
      return new Map(JSON.parse(cached) as Array<[string, number]>)
    } catch {
      await delKv(cacheKey)
    }
  }
  const rows = (await db.execute(
    sql`SELECT target_id, SUM(cnt)::int AS cnt FROM (
      SELECT target_id, count(*)::int AS cnt FROM galrc_event_views WHERE event_type = 'tag_view' GROUP BY target_id
      UNION ALL
      SELECT target_id, total::int AS cnt FROM galrc_stat_counters WHERE kind = 'tag_view'
    ) s GROUP BY target_id`,
  )) as Array<{ target_id: string; cnt: number }>
  const map = new Map(rows.map((r) => [r.target_id, r.cnt]))
  void setKv(cacheKey, JSON.stringify([...map]), 60 * 60)
  return map
}

/**
 * 本周 / 本月每个标签的浏览量（分类页「本周热门 / 本月热门」排序的数据源）。
 *
 * 只用明细表：galrc_stat_counters 是终身累计，没有时间桶，切不出时间窗；
 * 明细保留 EVENT_VIEW_RETENTION_DAYS（默认 90 天），「本月」窗口最长 31 天，
 * 始终落在保留期内。「本周」用 getEffectiveWeekStart 口径，与首页周榜一致。
 *
 * 时间窗聚合走 idx_galrc_event_views_type_created，只扫窗口内的行，
 * 比上面那句终身累计（237ms）便宜得多；而且只在 getTagGroups 缓存未命中时跑。
 */
async function getTagRecentViewCountMap(
  weekStart: Date,
  monthStart: Date,
): Promise<Map<string, { week: number; month: number }>> {
  const rows = (await db.execute(
    sql`SELECT target_id,
          count(*) FILTER (WHERE created_at >= ${weekStart})::int AS week_cnt,
          count(*)::int AS month_cnt
        FROM galrc_event_views
        WHERE event_type = 'tag_view' AND created_at >= ${monthStart}
        GROUP BY target_id`,
  )) as Array<{ target_id: string; week_cnt: number; month_cnt: number }>
  return new Map(
    rows.map((r) => [r.target_id, { week: r.week_cnt, month: r.month_cnt }]),
  )
}

type TagGroupKey =
  | 'character'
  | 'theme'
  | 'plot'
  | 'setting'
  | 'gameplay'
  // 层级未同步时的降级分类
  | 'cont'
  // 横切视角的「热门标签」，不参与语义分组
  | 'hot'

type TagGroupMeta = {
  key: TagGroupKey
  name: string
  slug: string
  description: string
  sortOrder: number
}

/** 分类下的标签条目（分类页与 hub 预览共用同一份结构） */
export type TagGroupItem = {
  id: string
  name: string
  /** 站内收录（alistb 存在）的关联游戏数 */
  vnCount: number
  /** 终身累计 tag_view 浏览量 */
  views: number
  /** 本周 tag_view 浏览量（分类页「本周热门」排序） */
  viewsWeek: number
  /** 本月 tag_view 浏览量（分类页「本月热门」排序） */
  viewsMonth: number
}

export type TagGroupCategory = TagGroupMeta & { tags: TagGroupItem[] }

type TagGroups = {
  /** 层级同步是否已跑过；未就绪时分类会塌缩到降级分组 */
  hierarchyReady: boolean
  /** 输出顺序：热门在前，语义分类居中，降级分组（如有）在末尾 */
  groups: TagGroupCategory[]
}

// 每类固定文案（与参考站一致），标签列表由实际数据填充
const TAG_HUB_GROUPS: TagGroupMeta[] = [
  {
    key: 'character',
    name: '角色与关系',
    slug: 'character',
    description: '妹妹、傲娇、大小姐、青梅竹马……',
    sortOrder: 10,
  },
  {
    key: 'theme',
    name: '题材与世界观',
    slug: 'theme',
    description: '异世界、校园、奇幻、科幻、悬疑……',
    sortOrder: 30,
  },
  {
    key: 'plot',
    name: '剧情与情节',
    slug: 'plot',
    description: '线性剧情、多结局、单一结局、专属路线……',
    sortOrder: 40,
  },
  {
    key: 'setting',
    name: '世界观与舞台',
    slug: 'setting',
    description: '日本、海外、校园、都会、幻想世界……',
    sortOrder: 50,
  },
  {
    key: 'gameplay',
    name: '玩法与风格',
    slug: 'gameplay',
    description: 'ADV、RPG、SLG、视觉小说、像素……',
    sortOrder: 60,
  },
]

// 层级未同步时的降级分组：把未经细分的 cont 标签原样呈现，
// 而不是错误地把上千个标签塞进「角色与关系」。
const TAG_HUB_FALLBACK_GROUP: TagGroupMeta = {
  key: 'cont',
  name: '其他剧情标签',
  slug: 'cont',
  description: '剧情与设定标签（层级同步后按主题细分）',
  sortOrder: 60,
}

// 顶层祖先（meta=true）决定分类。注意不能只看 cat：VNDB 的 cat 与标签树并不
// 对齐——g24 Plot 有 84% 是 tech、g674 Style 有 97% 是 tech，而 g1 Theme 底下
// 反而藏着 616 个 ero 标签。若按 cat 优先，剧情类会被玩法类吃掉。
// 同一标签可能挂在多个 meta 根下（VNDB 约 250 个），按固定优先级取第一个，
// 保证每次同步分类都稳定。
const META_ROOT_PRIORITY = ['g20', 'g1', 'g24', 'g22', 'g674']

const META_TO_GROUP: Record<string, TagGroupKey> = {
  g20: 'character', // Character → 角色与关系
  g1: 'theme', // Theme → 题材与世界观
  g24: 'plot', // Plot → 剧情与情节
  g22: 'setting', // Setting → 世界观与舞台
  g674: 'gameplay', // Style → 玩法与风格
}

// 无 meta 祖先时的兜底：按 VNDB 原始 cat 归类
const CAT_FALLBACK: Record<string, TagGroupKey> = {
  cont: 'character',
  ero: 'theme',
  tech: 'gameplay',
}

/**
 * 计算标签库的全部分类，以及每个分类下的**全部**标签（不截断），并缓存。
 *
 * hub（预览若干条）与分类页（列全部）都从这里取数，避免同一份全量聚合
 * 与层级递归被算两遍。标签一律按收录游戏数降序（参考站口径），同分按中文名
 * 排序，保证输出稳定、缓存可比对。
 *
 * 失效依赖：key 落在 `galzy:tags:hub:v3:*` 命名空间内 —— tagEdit / tagFileAdd /
 * vndb-sync / kungal-sync 的既有失效 pattern 会一并清掉，无需新增失效点。
 *
 * v3：条目新增 viewsWeek / viewsMonth（分类页「本周热门 / 本月热门」排序），
 * 旧缓存里没有这两个字段，必须换 key 而不是等 1h TTL 自然过期。
 */
async function getTagGroups(): Promise<TagGroups> {
  const cacheKey = 'galzy:tags:hub:v3:groups'
  const cached = await getKv(cacheKey)
  if (cached) {
    try {
      return JSON.parse(cached) as TagGroups
    } catch {
      await delKv(cacheKey)
    }
  }

  // 仅展示已本地化（zhtags 存在）的标签，避免点进去 404
  const rows = await db
    .select({
      id: tags.id,
      cat: tags.cat,
      meta: tags.meta,
      name: zhtags.name,
    })
    .from(tags)
    .innerJoin(zhtags, eq(tags.id, zhtags.id))

  // 两个全量聚合都走共享缓存 helper（与 tagCategories 共用同一份结果）
  // 时间窗聚合没有单独缓存：它只在 getTagGroups 缓存未命中时跑一次
  const [countMap, viewMap, recentViewMap] = await Promise.all([
    getTagGameCountMap(),
    getTagViewCountMap(),
    getTagRecentViewCountMap(getEffectiveWeekStart(), getMonthStart()),
  ])

  const tagIds = rows.map((r) => r.id)
  const rootOf = new Map<string, string>()
  let hierarchyReady = false
  if (tagIds.length > 0) {
    const rootRows = await db.execute(sql`
      WITH RECURSIVE up(child_id, root_id, depth) AS (
        SELECT c.id::text, p.parent, 1
        FROM ${tags} c
        INNER JOIN ${tagsRelations} p ON p.child = c.id
        WHERE c.id IN ${tagIds}
        UNION
        SELECT u.child_id, p.parent, u.depth + 1
        FROM up u
        INNER JOIN ${tagsRelations} p ON p.child = u.root_id
        -- 环保护，理由同 getTagDescendantIds 的 walk（见上）。
        WHERE u.depth < 64
      )
      SELECT child_id, root_id
      FROM up u
      INNER JOIN ${tags} t ON t.id = u.root_id
      WHERE t.meta = TRUE
    `)
    // DAG 中同一标签可能同深度挂在多个 meta 根下（VNDB 有 ~250 个这种 cont 标签，
    // 例如同时属于 g20 Character 与 g1 Theme）。按固定优先级取第一个，保证分类稳定。
    const rootsByChild = new Map<string, Set<string>>()
    for (const r of rootRows as Array<{
      child_id: string
      root_id: string
    }>) {
      let set = rootsByChild.get(r.child_id)
      if (!set) {
        set = new Set()
        rootsByChild.set(r.child_id, set)
      }
      set.add(r.root_id)
    }
    for (const [childId, roots] of rootsByChild) {
      const metaRoot = META_ROOT_PRIORITY.find((g) => roots.has(g))
      if (metaRoot) rootOf.set(childId, metaRoot)
    }
    hierarchyReady = rootOf.size > 0
  }

  const itemsByGroup = new Map<TagGroupKey, typeof rows>()
  for (const g of TAG_HUB_GROUPS) itemsByGroup.set(g.key, [])
  // 必须预置降级分组，否则层级未同步时 key='cont' 查不到桶，
  // `?.push()` 会静默丢弃全部标签（tagCount 全为 0）。
  itemsByGroup.set('cont', [])

  for (const r of rows) {
    const root = rootOf.get(r.id)
    // meta 树优先；层级缺失时回退到原始 cat，避免分类塌缩成一类
    const key: TagGroupKey = root
      ? META_TO_GROUP[root]
      : hierarchyReady
        ? CAT_FALLBACK[r.cat ?? 'cont']
        : 'cont'
    itemsByGroup.get(key)?.push(r)
  }

  // 收录数降序 + 中文名升序 → 稳定的 TagGroupItem 列表
  const toItems = (list: typeof rows): TagGroupItem[] =>
    [...list]
      .sort((a, b) => {
        const c = (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0)
        return c !== 0
          ? c
          : String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh')
      })
      .map((t) => ({
        id: t.id,
        name: t.name || t.id,
        vnCount: countMap.get(t.id) ?? 0,
        views: viewMap.get(t.id) ?? 0,
        viewsWeek: recentViewMap.get(t.id)?.week ?? 0,
        viewsMonth: recentViewMap.get(t.id)?.month ?? 0,
      }))

  const groups: TagGroupCategory[] = TAG_HUB_GROUPS.map((g) => ({
    ...g,
    tags: toItems(itemsByGroup.get(g.key) ?? []),
  }))

  // 「热门标签」：跨全部语义分类，按站内收录游戏数全局降序。
  // 与分类的排序口径一致（收录数），但不做分类归属限制 ——
  // 「热门」本身就是一个横切视角，同一主题下的高频标签理应聚在一起。
  const hotItems = toItems(rows.filter((r) => (countMap.get(r.id) ?? 0) > 0))
  if (hotItems.length > 0) {
    groups.unshift({
      key: 'hot',
      name: '热门标签',
      slug: 'hot',
      description: '全站收录游戏数最高的标签，按热度排序……',
      sortOrder: 0,
      tags: hotItems,
    })
  }

  // 仅在层级缺失且降级分组确有内容时追加，避免正常路径出现第六个分类
  if (!hierarchyReady) {
    const contItems = toItems(itemsByGroup.get('cont') ?? [])
    if (contItems.length > 0) {
      groups.push({ ...TAG_HUB_FALLBACK_GROUP, tags: contItems })
    }
  }

  const data = { hierarchyReady, groups }
  void setKv(cacheKey, JSON.stringify(data), 60 * 60)
  return data
}

/** 分类标签的排序依据，与 TagsModel.tagHub 的 sort 字面量联合对齐 */
type TagHubSort = 'count' | 'views' | 'hotWeek' | 'hotMonth' | 'name'

/** 排序方向，与 TagsModel.tagHub 的 order 字面量联合对齐 */
type TagHubOrder = 'desc' | 'asc'

/** 数值型排序依据的取值器（name 是唯一走字符串比较的依据，单独处理） */
const SORT_METRIC: Record<
  Exclude<TagHubSort, 'name'>,
  (t: TagGroupItem) => number
> = {
  count: (t) => t.vnCount,
  views: (t) => t.views,
  hotWeek: (t) => t.viewsWeek,
  hotMonth: (t) => t.viewsMonth,
}

/**
 * 按「依据 + 方向」排列分类标签。
 *
 * count + desc 就是 getTagGroups 的规范顺序（收录数降序 + 中文名升序），
 * 直接原样返回；其余组合在这里读时排序 —— 全量列表只缓存一份，不值得为
 * 每种排序各缓存一遍。必须**先排序再切片**，否则「按浏览次数取前 N」会退化
 * 成「收录数前 N 条里再按浏览次数排」，两个口径完全不是一回事（实测 恋爱
 * 661 收录 / 2.7 万浏览，处女丧失 869 收录 / 36 浏览，两者经常不在同一批
 * 候选里）。
 *
 * hotWeek / hotMonth 是时间窗热度（本周 / 本月 tag_view 浏览量），窗口内
 * 数据会随事件增长而变化。方向只翻转主键，并列时一律回落规范次序
 * （收录数降序 + 中文名升序），保证输出稳定、缓存可比对。
 */
function sortTagItems(
  list: TagGroupItem[],
  sort: TagHubSort = 'count',
  order: TagHubOrder = 'desc',
): TagGroupItem[] {
  if (sort === 'count' && order === 'desc') return list
  const sorted = [...list]
  const dir = order === 'asc' ? 1 : -1
  if (sort === 'name') {
    sorted.sort(
      (a, b) =>
        dir * a.name.localeCompare(b.name, 'zh') || b.vnCount - a.vnCount,
    )
    return sorted
  }
  const metric = SORT_METRIC[sort]
  sorted.sort(
    (a, b) =>
      dir * (metric(a) - metric(b)) ||
      b.vnCount - a.vnCount ||
      a.name.localeCompare(b.name, 'zh'),
  )
  return sorted
}

export const Tags = {
  async gameTags({ id }: TagsModel.gameTags) {
    const cacheKey = `galzy:game:tags:${id}`

    // 1. 尝试从缓存读取
    const redisData = await getKv(cacheKey)
    if (redisData) {
      try {
        return JSON.parse(redisData) as Tag
      } catch {
        // 缓存损坏 → 删除并继续查库
        await delKv(cacheKey)
      }
    }

    // 2. 判断 id 是否为数字
    const idIsNumber = /^\d+$/.test(id)

    // 3. 查询数据库
    const items = await db
      .select({
        tags: sql<Array<Record<string, any>>>`COALESCE(
          (SELECT json_agg(
            json_build_object(
              'tag_data', CASE WHEN z.id IS NOT NULL THEN
                json_build_object(
                  'id', t.id,
                  'name', t.name,
                  'description', t.description,
                  'zht_name', z.name,
                  'zht_description', z.description
                )
              ELSE NULL END
            )
          )
          FROM (
            SELECT tv.tag, AVG(tv.vote) AS avg_vote
            FROM ${tagsVn} tv
            WHERE tv.vid = ${vn.id} AND tv.vote > 0
            GROUP BY tv.tag
            HAVING AVG(tv.vote) > 1
          ) sub
          INNER JOIN ${tags} t ON t.id = sub.tag
          LEFT JOIN ${zhtags} z ON z.id = t.id AND z.exhibition = TRUE
          ), '[]'::json
        )`,
      })
      .from(alistb)
      .innerJoin(vn, eq(alistb.vid, vn.id))
      .where(
        idIsNumber
          ? or(eq(alistb.vid, id), eq(alistb.other, Number(id)))
          : eq(vn.id, id),
      )
      .limit(1)
      .then((r) => r[0])

    if (!items) {
      throw status(404, `没有找到数据: id=${id}`)
    }

    const result = structuredClone(items)

    // 写入缓存（失败时只记录，不影响结果返回）
    void setKv(cacheKey, JSON.stringify(result), 60 * 60)

    // 类型定义：保证 result 不会是 undefined
    type Tag = NonNullable<typeof result>
    return result
  },
  async tag({ tagId }: TagsModel.tagId) {
    // v5：新增 ancestorPaths —— 层级是 DAG，同一个标签可能有多条到根的路径
    // （g513 Netorare 同时属于 Jealousy 与 Sex with Others 两条链）。
    // ancestors 保持 v4 的旧语义（扁平 + 最短距离）仅供不关心分支的调用方使用；
    // 面包屑改用 ancestorPaths，否则把不同分支按深度拼成一条线会渲染出
    // 「Drama > Sexual Content > …」这类并不存在的祖先链。
    const cacheKey = `galzy:tag:v5:${tagId}`
    const redisdata = await getKv(cacheKey)
    if (redisdata !== null && redisdata !== undefined) {
      return JSON.parse(redisdata) as Tag
    }
    const items = await db
      .select({
        id: tags.id,
        name: tags.name,
        description: tags.description,
        cat: tags.cat,
        meta: tags.meta,
        vnCount: tags.vnCount,
        zht_name: zhtags.name,
        zht_description: zhtags.description,
      })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))
      .where(eq(tags.id, tagId))
      .limit(1)
      .then((r) => r[0])

    if (!items) {
      throw status(404, `Tag ${tagId} 不存在`)
    }

    const [ancestorPathIds, childIds] = await Promise.all([
      getTagAncestorPaths(tagId),
      getTagDescendantIds(tagId),
    ])
    const [labelMap, descendants] = await Promise.all([
      fetchTagLabelMap([...new Set(ancestorPathIds.flat())]),
      fetchTagLabels(childIds),
    ])

    const labelOf = (id: string) =>
      labelMap.get(id) ?? { id, name: null, zht_name: null }
    // 每条路径直接渲染成一行面包屑（根 → … → 直接父级）
    const ancestorPaths = ancestorPathIds.map((path) => path.map(labelOf))
    // 兼容字段：扁平祖先集合（不区分分支），保持 v4 的「最短距离降序」语义。
    // v4 走 fetchTagLabels（innerJoin zhtags），未本地化的祖先会被过滤掉；这里
    // 同样过滤，避免旧调用方拿到必然 404 的节点。未本地化的祖先只出现在
    // ancestorPaths 里（那里必须保留，否则链路会断），由前端渲染成不可点击文本。
    const depthOf = new Map<string, number>()
    for (const path of ancestorPathIds) {
      path.forEach((id, index) => {
        const depth = path.length - index
        const prev = depthOf.get(id)
        if (prev === undefined || depth < prev) depthOf.set(id, depth)
      })
    }
    const ancestors = [...depthOf.keys()]
      .filter((id) => Boolean(labelMap.get(id)?.zht_name))
      .map((id) => ({ ...labelOf(id), depth: depthOf.get(id) ?? 0 }))
      .sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id))

    // 直接子标签（深度=1）用于页面折叠展示；全部后代仅用于计数参考。
    // 两者不能混用：g360「其他要素」有 430 个后代，但直接子标签只有 94 个。
    const directChildren = descendants.filter((c) => c.depth === 1)

    const result = {
      ...structuredClone(items),
      // VNDB 原文含 BBCode 标记，展示前清理；本地化描述保持原样
      description: items.description
        ? stripVndbMarkup(items.description)
        : items.description,
      ancestors,
      ancestorPaths,
      children: directChildren,
      descendantCount: descendants.length,
    }
    void setKv(cacheKey, JSON.stringify(result), 60 * 60 * 1)
    type Tag = typeof result
    return result
  },
  async tagGames({
    tagId,
    pageSize,
    pageIndex,
    includeChildren = false,
  }: TagsModel.tagGames) {
    const cacheKey = `galzy:tag:games:v2:${tagId}:${pageSize}:${pageIndex}:${includeChildren}`

    const offset = pageIndex * pageSize

    // includeChildren 对齐 VNDB `tag` 过滤器的语义：命中该标签或任意后代标签。
    // 不开启时等价于 VNDB 的 `dtag`（仅直接标注）。
    const matchIds = includeChildren
      ? [tagId, ...(await getTagDescendantIds(tagId)).map((r) => r.id)]
      : [tagId]
    const tagMatch = inArray(tagsVn.tag, matchIds)

    // 并行执行 主查询 + 统计查询
    // 总数只由 (tagId, includeChildren) 决定，与分页无关。原实现把它和分页结果塞进
    // 同一个含 pageIndex 的缓存 key，导致每翻一页都重算一次 count(DISTINCT vid)
    // （实测 g1 + includeChildren：count 94ms、主查询 252ms）。这里单独缓存总数。
    const countCacheKey = `galzy:tag:games:count:v1:${tagId}:${includeChildren}`
    const cachedCountRaw = await getKv(countCacheKey)
    const cachedCount =
      cachedCountRaw === null || cachedCountRaw === undefined
        ? null
        : Number(cachedCountRaw)

    const [mainResult, resolvedCount] = await Promise.all([
      db
        .select({
          id: vn.id,
          olang: vn.olang,
          titles: sql<
            Array<{
              lang: string | null
              official: boolean | null
              title: string | null
              latin: string | null
            }>
          >`COALESCE(
            (SELECT json_agg(row_to_json(vnt.*)) FROM ${vnTitles} vnt WHERE vnt.id = ${vn.id}),
            '[]'::json
          )`,
          images: sql<{
            id: string
            height: number | null
            width: number | null
            c_sexual_avg: number | null
            url: string | null
            thumbhash?: string | null
            imageUrl?: string | null
          } | null>`(SELECT row_to_json(img.*)
            FROM (SELECT id, height, width, c_sexual_avg, url FROM ${images} img WHERE img.id = ${vn.cImage}) img
          )`,
          other: alistb.other,
          other_datas: sql`(SELECT row_to_json(od.*)
            FROM (
              SELECT o.*, ${alistb.other} AS other,
                COALESCE(
                  (SELECT json_agg(row_to_json(om_sub.*))
                   FROM (
                     SELECT om.*,
                       (SELECT row_to_json(m.*) FROM ${media} m WHERE m.hash = om.media_hash) AS media
                     FROM ${otherMedia} om WHERE om.other_id = o.id
                   ) om_sub
                  ), '[]'::json
                ) AS other_media
              FROM ${others} o WHERE o.id = ${alistb.other}
            ) od
          )`,
        })
        .from(tagsVn)
        .innerJoin(alistb, eq(alistb.vid, tagsVn.vid))
        .innerJoin(vn, eq(vn.id, alistb.vid))
        .where(tagMatch)
        // 刻意不把 tagsVn.tag 放进 GROUP BY：includeChildren 放宽成 IN 后，
        // 一部 VN 可能同时命中父标签与后代标签，按 tag 分组会让同一 vid
        // 输出多行（列表重复），且与 count 查询的 countDistinct(vid) 对不上，
        // 导致分页错位。这里只按 vid 分组，保证每部作品一行。
        .groupBy(tagsVn.vid, vn.id, vn.olang, vn.cImage, alistb.other)
        .orderBy(desc(tagsVn.vid))
        .limit(pageSize)
        .offset(offset),

      cachedCount !== null && Number.isFinite(cachedCount)
        ? Promise.resolve(cachedCount)
        : db
            .select({ count: countDistinct(tagsVn.vid) })
            .from(tagsVn)
            .innerJoin(alistb, eq(alistb.vid, tagsVn.vid))
            .where(tagMatch)
            .then((r) => Number(r[0]?.count ?? 0)),
    ])

    const items = mainResult

    const totalCount = resolvedCount
    if (cachedCount === null) {
      void setKv(countCacheKey, String(totalCount), 60 * 60)
    }

    const kungalRows =
      items.length > 0
        ? await db
            .select({
              vndbId: kungalWorks.vndbId,
              coverUrl: kungalWorks.coverUrl,
              coverWidth: kungalWorks.coverWidth,
              coverHeight: kungalWorks.coverHeight,
              coverThumbhash: kungalWorks.coverThumbhash,
            })
            .from(kungalWorks)
            .where(
              inArray(
                kungalWorks.vndbId,
                items.map((item) => item.id),
              ),
            )
        : []
    const kungalMap = new Map(kungalRows.map((row) => [row.vndbId, row]))

    // Transform image URLs: replace VNDB host with configured CDN
    for (const item of items) {
      const img = item.images as Record<string, unknown> | null
      const kungal = kungalMap.get(item.id)
      if (
        hasUsablePortraitCover({
          url: kungal?.coverUrl,
          width: kungal?.coverWidth,
          height: kungal?.coverHeight,
        })
      ) {
        ;(item as any).images = {
          ...(img ?? { c_sexual_avg: 0 }),
          id: null,
          url: kungal?.coverUrl,
          imageUrl: kungal?.coverUrl,
          width: kungal?.coverWidth,
          height: kungal?.coverHeight,
          thumbhash: kungal?.coverThumbhash,
        }
      } else if (img) {
        img.imageUrl = img.id
          ? buildCoverUrl(
              img.id as string,
              img.width as number,
              img.height as number,
            )
          : null
        if (img.url) {
          img.url = transformStoredUrl(img.url as string)
        }
      }
    }
    const totalPages = Math.ceil(totalCount / pageSize)

    const data = {
      items,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }

    void setKv(cacheKey, JSON.stringify(data), 60 * 60)

    return data
  },
  async tagAllGet({ pageSize, pageIndex, keyword, id }: TagsModel.tagAll) {
    const offset = pageIndex * pageSize

    // 构建 keyword 与 id 的组合条件，用于两个查询复用
    const keywordConditions: SQL[] = []
    if (keyword) {
      // or() with 3 valid conditions never returns undefined
      keywordConditions.push(
        or(
          like(zhtags.name, `%${keyword}%`),
          like(zhtags.alias, `%${keyword}%`),
          like(zhtags.description, `%${keyword}%`),
        )!,
      )
    }
    if (id) {
      keywordConditions.push(like(tags.id, `%${id}%`))
    }
    const combinedFilter: SQL | undefined =
      keywordConditions.length > 0
        ? keywordConditions.length === 1
          ? keywordConditions[0]
          : and(...keywordConditions)
        : undefined

    // 1. 查询分页数据（单次 .where() 调用）
    const dataQuery = db
      .select({
        id: tags.id,
        zh_name: zhtags.name,
        zh_description: zhtags.description,
        zh_alias: zhtags.alias,
        exhibition: zhtags.exhibition,
      })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))

    const data = await (combinedFilter
      ? dataQuery.where(combinedFilter)
      : dataQuery
    )
      .orderBy(asc(tags.id))
      .limit(pageSize)
      .offset(offset)

    // 2. 查询总数（与 data 查询使用相同过滤条件）
    const countQuery = db
      .select({ count: count() })
      .from(tags)
      .innerJoin(zhtags, eq(tags.id, zhtags.id))

    const totalCountResult = await (combinedFilter
      ? countQuery.where(combinedFilter)
      : countQuery
    ).then((r) => r[0])

    const totalCount = Number(totalCountResult?.count || 0)
    const totalPages = Math.ceil(totalCount / pageSize)

    return {
      items: data,
      currentPage: pageIndex,
      totalPages,
      totalCount,
    }
  },
  /**
   * 标签库 hub：按 VNDB 标签树的五个顶层主题平铺，每类给出预览标签。
   *
   * 分类直接对应 VNDB 的 5 个 meta 根标签，一一映射、互斥无重叠：
   *   g20 Character → 角色与关系      g1  Theme  → 题材与世界观
   *   g24 Plot      → 剧情与情节      g22 Setting→ 世界观与舞台
   *   g674 Style    → 玩法与风格
   *
   * 刻意不照搬参考站（dg.zi0.in/tags）的「成人内容」分类：VNDB 的 cat 是内容
   * 分级轴而非主题轴，与标签树大量交叉（g1 Theme 下有 608 个 cat=ero 标签）。
   * 若按 ero 单独分组，就得让同一个标签同时出现在两个分类里。
   * 分类归属由 tags_relations 的祖先关系推导，因此依赖层级同步已跑过。
   *
   * 完整分类树来自 getTagGroups()（缓存），这里只做预览截断。
   * 「每个分类下还有多少标签」由 tagCount 诚实给出，前端的「查看全部」
   * 走 tagGroup() 拿未截断的全量列表。
   *
   * sort + order 在切片之前生效，前端的「依据（收录数 / 总浏览量 / 本周 /
   * 本月 / 名称）」与「方向（倒序 / 正序）」两个筛选因此拿到的是真正的前
   * N 名，而不是在某一批预览里二次排序。
   */
  async tagHub(
    {
      group,
      limit = 24,
      sort = 'count',
      order = 'desc',
    }: TagsModel.tagHub = {} as TagsModel.tagHub,
  ) {
    // v3：条目带 viewsWeek / viewsMonth，与 getTagGroups 的缓存版本同步
    const cacheKey = `galzy:tags:hub:v3:${group ?? 'all'}:${limit}:${sort}:${order}`
    const cached = await getKv(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {
        await delKv(cacheKey)
      }
    }

    const { groups } = await getTagGroups()
    const categories = groups
      .filter((g) => !group || g.key === group)
      .map((g) => ({
        key: g.key,
        name: g.name,
        slug: g.slug,
        description: g.description,
        sortOrder: g.sortOrder,
        tagCount: g.tags.length,
        previewTags: sortTagItems(g.tags, sort, order).slice(0, limit),
      }))

    const data = { categories }
    void setKv(cacheKey, JSON.stringify(data), 60 * 60)
    return data
  },
  /**
   * 标签库分类页：某一分类下的**全部**标签（不截断）。
   *
   * hub 的 previewTags 只给前 N 条，limit 上限 500 —— 而单个分类实测可超
   * 1000 个标签，所以「查看全部」必须走这个接口。分类不存在（例如层级未
   * 同步时访问 cont 之外的降级分类）时返回 category: null，由页面兜底。
   */
  async tagGroup({ group }: TagsModel.tagGroup) {
    const { groups } = await getTagGroups()
    const found = groups.find((g) => g.key === group)
    if (!found) return { category: null }
    return {
      category: {
        key: found.key,
        name: found.name,
        slug: found.slug,
        description: found.description,
        sortOrder: found.sortOrder,
        tagCount: found.tags.length,
        tags: found.tags,
      },
    }
  },
  async tagCategories(): Promise<
    Record<
      string,
      Array<{ id: string; name: string; vnCount: number; views: number }>
    >
  > {
    const cacheKey = 'galzy:tags:categories:v4'
    const cached = await getKv(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch {
        await delKv(cacheKey)
      }
    }

    // 与详情页口径一致：仅展示已本地化（zhtags 存在）的标签，避免点进去 404
    // vnCount = 站内收录（alistb 存在）的关联游戏数，与标签详情页列表口径一致
    // views = 累计 tag_view 浏览量（供排序）
    const [rows, countMap, viewMap] = await Promise.all([
      db
        .select({
          id: tags.id,
          cat: tags.cat,
          name: zhtags.name,
        })
        .from(tags)
        .innerJoin(zhtags, eq(zhtags.id, tags.id)),
      // 与 tagHub 共用同一份缓存结果，避免同一小时里重复算两遍
      getTagGameCountMap(),
      getTagViewCountMap(),
    ])

    const grouped: Record<
      string,
      Array<{ id: string; name: string; vnCount: number; views: number }>
    > = {
      cont: [],
      ero: [],
      tech: [],
    }
    for (const r of rows) {
      const list = grouped[r.cat ?? ''] ?? grouped.cont
      list.push({
        id: r.id,
        name: r.name || r.id,
        vnCount: countMap.get(r.id) ?? 0,
        views: viewMap.get(r.id) ?? 0,
      })
    }
    for (const list of Object.values(grouped)) {
      list.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    }

    void setKv(cacheKey, JSON.stringify(grouped), 60 * 60)
    return grouped
  },
  async tagEdit({
    zh_name,
    exhibition,
    zh_alias,
    zh_description,
    id,
  }: TagsModel.tagEdit) {
    try {
      await db
        .update(zhtags)
        .set({
          name: zh_name,
          exhibition,
          alias: zh_alias,
          description: zh_description,
        })
        .where(eq(zhtags.id, id))
      await purgeTagPages(String(id))
      // 标签详情 / 游戏标签 / 分类页缓存同步失效（含本地化名称、展示状态）
      await delKv(`galzy:tag:v5:${id}`)
      await delKvPattern('galzy:game:tags:*')
      await delKv('galzy:tags:categories:v4')
      // 标签库 hub 也读 zhtags.name，编辑后必须一并失效，
      // 否则 /tags 会继续展示旧中文名直到 1h TTL 自然过期。
      await delKvPattern('galzy:tags:hub:v3:*')
      return true
    } catch {
      return false
    }
  },

  async tagFileAdd({ file }: TagsModel.tagFileAdd) {
    const text = await file.text()
    const datas = JSON.parse(text)
    const datass = datas.map(
      (item: {
        id: number
        name: string
        exhibition: boolean
        alias: string
        description: string
      }) => ({
        id: item.id,
        name: item.name,
        exhibition: item.exhibition,
        alias: item.alias,
        description: item.description,
      }),
    )

    // 分批 upsert：一次 3015 行会超出 Postgres 参数上限（单列 65535，
    // 但这里每行 4 列仍受 statement 体积与参数总数约束，分批更稳）。
    // set 里必须用 incoming（EXCLUDED 语义），写成 zhtags.xxx 会自赋值成空操作。
    const BATCH = 500
    for (let i = 0; i < datass.length; i += BATCH) {
      await db
        .insert(zhtags)
        .values(datass.slice(i, i + BATCH))
        .onConflictDoUpdate({
          target: zhtags.id,
          set: {
            name: sql`excluded.name`,
            exhibition: sql`excluded.exhibition`,
            alias: sql`excluded.alias`,
            description: sql`excluded.description`,
          },
        })
    }

    // Batch import: purge tag list (individual pages too many)
    await purgeByTags(['page-tags'])
    // 批量导入影响所有标签缓存：详情页 / 游戏标签 / 分类页 / 层级递归 / 标签库 hub。
    // galzy:tag:* 匹配不到 galzy:tags:hub:v3:*（Redis MATCH 要求 tag 后紧跟冒号），
    // 所以 hub 缓存必须单独按完整前缀删除。
    await delKvPattern('galzy:tag:*')
    await delKvPattern('galzy:game:tags:*')
    await delKvPattern('galzy:tags:rel:*')
    await delKvPattern('galzy:tags:hub:v3:*')
    await delKv('galzy:tags:categories:v4')

    return true
  },
  async tagAllFileDwn() {
    const datas = await db
      .select({
        id: zhtags.id,
        name: zhtags.name,
        exhibition: zhtags.exhibition,
        alias: zhtags.alias,
        description: zhtags.description,
      })
      .from(zhtags)
    return datas
  },
}
