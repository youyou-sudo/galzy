# 用户视图缓存：ISR 源站缓存 + CDN 边缘缓存 + 数据更新即时失效

> 用户端页面（首页 / 游戏 / 标签 / 合集 / 厂商 / 论坛 / 友链…）走 **ISR** 生成
> 静态化 HTML，源站（Redis）与 CDN 各存一份；只有数据真的变了，才清掉**相关条目**
> 的缓存并重新生成。后台、用户中心、登录注册、创建/编辑页仍为纯 SSR。
>
> 两个进程只通过 Redis 频道通信，**web 端只认一条 `REDIS_URL`**（与 API 后端
> 相同的 Bun 客户端约定），不需要内部 HTTP 接口、共享密钥或 CDN 凭据。

## 1. 架构

```
浏览器 ──▶ CDN(Cloudflare) ──▶ web(Furin, ISR) ──▶ Redis(页面产物缓存)
                ▲                  │  ▲                    │
                │                  │  └─ subscribe ────────┘
                │                  │      galzy:isr:invalidate
                │                  │
                │  purge CdnUrls   │  revalidatePath/Tag → publish galzy:isr:cdn-purge
                └─────── API(Cloudflare 凭据) ◀── subscribe
```

三层缓存：

| 层 | 位置 | 内容 | 失效方式 |
| --- | --- | --- | --- |
| 浏览器/边缘 | Cloudflare | 完整 HTML | web 失效后把 URL 回传 API → CF 按 URL 清 |
| 源站页面缓存 | Redis（`redisPageCache`） | 完整 HTML + 切页 NDJSON | `revalidatePath` / `revalidateTag` |
| 页面 meta | HTML head | title/meta | 随页面一起重生成 |

## 2. 路由分级（`config({ mode })`）

| 路由 | mode | revalidate | tags |
| --- | --- | --- | --- |
| `/` 首页 | isr | 60 | `page-home` |
| `/games` 列表 | isr | 60 | `page-games` |
| `/[id]` 及全部页签 | isr | 300 | `page-games` |
| `/tags`、`/tags/[tagId]`、`/tags/category/*` | isr | 120~300 | `page-tags` |
| `/collections`、`/collections/[id]` | isr | 120~300 | `page-collections` |
| `/producer`、`/producer/[pid]` | isr | 300 | `page-producers` |
| `/topics`、`/topics/[topicId]` | isr | 60~120 | `page-topics` |
| `/friend-links` | isr | 300 | `page-friend-links` |
| `/contact`、`/openapi`、`/tools` | isr | 3600 | — |
| `/[id]/comment` | ssr | — | 评论区依赖登录态（点赞/我的评论），不做公共缓存 |
| `/admin/**`、`/user/**`、`/auth/**`、创建/编辑页 | ssr | — | 个性化页面 |

根布局 `pages/root.tsx` 也是 `isr`（**否则整条链会被判定为 ssr**，见 furin
`resolveDocumentMode`）。根布局只缓存公共数据（顶部广告位）；**登录态不进缓存**：

- `isPersonalizedPath(path)` 命中的页面（后台/用户中心/登录/创建编辑）才在
  服务端取会话并 seed 进 React Query，`authKnown = true`；
- 用户视图 `authKnown = false`：登录态由客户端 `useAuthSession()` 查询
  （会话已由 Redis 加速），绝不把某个人的登录态写进共享 HTML。

论坛列表/详情的 loader 用 `publicOnly: true` 调用 BFF，跳过会话与 cookie 透传，
保证缓存内容对所有人一致。

## 3. 失效链路（Redis 频道，单 `REDIS_URL`）

1. API 写操作成功（2xx 的 POST/PUT/PATCH/DELETE）→
   `apps/api/src/index.ts` 的 `onAfterHandle` → `libs/isr-invalidation.ts` 按路由前缀分流 →
   `libs/cloudflare-cache.ts` 的语义 helper（`purgeGamePages` / `purgeCollectionPages` /
   `purgeTopicPages` / `purgeFriendLinksPage` / `purgeAfterSync` …）；
2. helper 把 `{ paths, tags, type }` **publish 到 `galzy:isr:invalidate`**；
3. web 进程（`lib/isr/invalidate.ts`）订阅该频道 → `revalidatePath()` / `revalidateTag()`：
   - 删 Redis 里的 ISR 页面产物（`revalidateTag` 能连带清掉列表页所有查询串变体）；
   - 触发 `cachePurger`（`lib/isr/cdn-purge.ts`），把**实际失效的 URL** publish 到
     `galzy:isr:cdn-purge`；
4. API 进程（`libs/redis/pubsub.ts`）订阅 `galzy:isr:cdn-purge` → 用 Cloudflare 凭据
   （`SITE_URL` + `CLOUDFLARE_ZONE_ID/API_TOKEN`，本来就在 API 环境里）按 URL 清边缘缓存；
5. 下一个请求重新生成并回填缓存。

## 4. 环境变量

| 进程 | 变量 | 作用 | 缺失时 |
| --- | --- | --- | --- |
| web | `REDIS_URL` | ISR 页面缓存 + 失效订阅（与 API 同一条连接串） | 回落到进程内缓存；不订阅失效（只靠 TTL） |
| web | `REDIS_ENABLED` | 本地开发强制启用 Redis（生产默认启用） | 开发默认不用 Redis |
| api | `REDIS_URL` | publish 失效消息 / 订阅 CDN 清理（**已在用**） | 无失效通知 |
| api | `SITE_URL`（或 `WEB_HOST`） | 拼 CDN 清理 URL 的 origin | 跳过 CDN 清理 |
| api | `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN` | Cloudflare 清理凭据 | 跳过 CDN 清理 |

**Cloudflare 侧仍需配 Cache Rule**（代码无法替代）：对 `/admin/*`、`/api/*`、
`/auth/*`、`/user/*` 走 Bypass；其余 GET 页面启用缓存并「尊重源站
Cache-Control」。ISR 响应头是
`public, max-age=0, s-maxage=<revalidate>, stale-while-revalidate=<revalidate>`。

## 5. 验证

```bash
# 1) 两次请求同一页面：第二次应命中（更快），响应头带 s-maxage
curl -s -D - -o /dev/null http://localhost:3100/contact | grep -i cache-control
curl -s -o /dev/null -w '%{time_total}s\n' http://localhost:3100/contact
# 源站日志：cache: "miss" → "hit"

# 2) 模拟 API 的数据更新：往 Redis 频道发一条失效消息
bun -e 'import { redis } from "bun";
await redis.publish("galzy:isr:invalidate", JSON.stringify({ paths: ["/contact"], tags: ["page-home"] }));' 
# web 日志出现 [isr] 处理失效 → 再请求 /contact 重新 miss 并回填
```

## 6. 已知取舍

- 用户视图的登录态是客户端查询出来的（共享缓存的前提），首屏头像比 SSR 迟一次
  请求；会话查询已走 Redis，通常几毫秒。
- 列表页带筛选的变体靠 `tags` 失效 + `stale-while-revalidate` 自愈；新增列表筛选
  维度时记得把对应路由加入 `tags`。
- 评论区/后台等个性化页面保持 SSR，不进 CDN。
- 广告位出现在所有公共页面：广告变更只即时清首页，其余页面在各自
  `revalidate` 窗口内更新。
- CDN 按 URL 精确清理（单批 30 条），带查询串的列表变体无法枚举，
  靠较短的 `revalidate` + `stale-while-revalidate` 自愈。
