# 客户端导航性能：预取策略

> 结论：**默认不靠「视口成片预取」换流畅度**。用户视图（列表/首页）的卡片预取
> 改为「意图触发」，空闲预取压到极少量并在开发模式关闭；
> 配合 SSR/ISR 文档 + 路由/数据缓存，点击依然秒开，但页面加载不再被预取拖住。

## 1. 排查：预取确实在拖慢页面

用 CDP（Chrome DevTools Protocol）抓真实浏览器请求，统计一次加载里
`?_furin=data` 的数量（这些请求会跑完整 loader 链：web BFF → API → DB/Meili）：

| 页面 | 改动前 | 改动后 |
| --- | --- | --- |
| `/`（首页） | **16 条**：10 张游戏卡 + 5 个标签页 + 4 个列表入口 | **0 条**（dev）/ **2 条**（prod，load 后空闲） |
| `/games`（列表，24 卡） | 每条可见卡片各 1 条，实测 7~18 条 | **0 条**（悬停某张卡才 1 条） |
| `/v19073`（详情） | 5 个页签各 1 条（挂载即预取） | **0 条**（dev）/ 5 条（prod，load 后空闲） |

为什么这会让页面「卡」：

1. 浏览器对同源只有 ~6 条并发连接（HTTP/1.1），16 条预取把连接占满，
   图片、`/api/auth/get-session`、用户点击后的导航请求全部排队；
2. 每条预取都要跑完整 loader 链，服务端 CPU/连接池被占；
3. 开发模式（`bun --hot`）下 `?_furin=data` 还会**按需编译路由**，
   单条耗时 1~8s，实测首页 16 条预取在 20s 内一条都没跑完 —— 完全是在添乱。

## 2. 改动

### 2.1 卡片预取：视口 → 意图

`apps/web-tanstack/src/hooks/use-viewport-preload.ts`

- 新增 `PREFETCH_MODE`：`intent`（默认）/ `viewport` / `off`；
- `intent` 模式监听 `pointerenter`（停留 60ms 才发）、`focus`、`pointerdown`
  （触屏没有 hover，按下即预取，能在 click 导航前抢一次请求）；
- 同一元素只绑定一次（`useViewportPreload` 与 `useIntentPreload` 可共存）；
- 省流/弱网（`saveData`、`2g`）不预取；
- 并发上限 4 → **2**；
- `viewport` 模式保留（`rootMargin: 0`、空闲调度、整页预算 8），需要时再开。

### 2.2 空闲预取：等 load + 预算 + 开发模式关闭

`apps/web-tanstack/src/hooks/use-idle-preload.ts`

- 等 `window.load`（首屏图片/字体下完）再进 `requestIdleCallback`，不和首屏抢连接；
- 整页预算 `IDLE_PRELOAD_BUDGET = 6`，超出不再自动预取；
- 后台标签页（`document.visibilityState === "hidden"`）不预取；
- **开发模式直接跳过**：`pages/root.tsx` loader 下发 `dev`，`setPrefetchDevMode(dev)`
  控制；`bun --hot` 按需编译下预取只会添乱，生产构建没有这个开销。
- 首页只保留 2 个入口的空闲预取（更多游戏 / 更多合集），标签、会社、热门分类
  交给点击（它们是 ISR 页面，点击本身命中边缘/页面缓存）。

## 3. 不预取也能流畅：靠什么

1. **SSR/ISR 文档 = SEO + 首屏**：爬虫拿到的 HTML 里就有数据，与预取无关；
2. **点击即反馈**：顶栏 180ms 后出现的导航指示条 + 保留旧页面直到新数据提交，
   不出现白屏；
3. **路由缓存**：`staleTime`/`gcTime`（登录态 60s、query `gcTime` 5min），
   回退/重复访问直接命中，不需要请求；
4. **意图预取**：hover/focus/pointerdown 命中率高、无滚动洪峰——这是
   「零预取」与「零等待」之间的折中；
5. 需要更激进时：给详情页做「骨架先渲染 + `useQuery` 补数据」（`isNavigating`
   状态下渲染 skeleton）、或对首屏前 2 条内联预算数据；再往上就是 HTTP/2/3 +
   CDN 边缘命中（文档层已在做 ISR）。

## 4. 实测命令

```bash
# 用 CDP 统计一次加载里的 _furin=data 请求（脚本在 /tmp/probe/probe.ts）
#   bun probe.ts http://localhost:3005/ 9222        # 无 hover
#   bun probe.ts http://localhost:3005/ 9222 hover  # 模拟悬停一张卡
```

预期：`/`、`/games`、`/v19073` 加载时 `_furin=data` = 0；
hover 一张卡 → 恰好 1 条（该卡的 `?_furin=data`）。
