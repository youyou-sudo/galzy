# Galzy BUG 审计报告（2026-08-24）

> 审计方式：静态检查（tsc / biome / oxlint）+ 两个并行子代理深审（Redis 缓存一致性、BFF 契约）+ 运行验证（实际启动 web dev server 探测 `/api/*` 代理路由）。
> 验证依据：源码逐行核对；`/api/health` 实测 200 `{"ok":true}`；tsc 全量输出见 `/tmp/tsc-api.txt`、`/tmp/tsc-web.txt`。
> 说明：API 构建（`bun build --compile`）与 web 构建（vite build）**均不执行 tsc**，因此以下类型错误不会拦截构建，多数也不影响运行——已逐条区分「运行期 BUG」与「类型健康问题」。

---

## 一、运行期 BUG（按严重度排序）

### 1.1 高 — 游戏列表缓存键冲突：asc/desc 排序串号（最长 2h 返回错误排序）

`apps/api/src/modules/games/service.ts:76-77`

```ts
const useCache = !sortBy || sortBy === 'id'
const cacheKey = `galzy:game:list:${pageIndex}:${pageSize}${useCache ? '' : `:${sortBy}:${order}`}`
```

`sortBy` 为 `'id'` 或缺省时 key 省略 `:order`，而 `orderClause`（L79+）用 `order` 决定 ASC/DESC。**id 正序与倒序请求共享同一缓存键**，后到者拿到前者的排序结果，直到 2h TTL。已确认源码。

### 1.2 高 — `vidassociationCreate` 幂等键写错 + 去重窗口仅 2s（重复插入）

`apps/api/src/modules/games/service.ts:842-870`

- 检查/占锁用 `galzy:idempotent:vidassociationCreate:action`（TTL **2s**）
- 结果却写入 **`vidassociationCreate:action`**（无 `galzy:idempotent:` 前缀，且从不被读取）TTL 2s

结果重放永远失效；**超过 2s 的重复调用会重跑事务，重复插入 `others` + `alistb` 行**。且键名固定（非参数哈希），任意两次 2s 内的调用互相碰撞。已确认源码。

### 1.3 高 — 幂等结果重放系统性失效（6 处存空串）

`storeIdempotentResult(key, '', 60)` → 存的是 `JSON.stringify('')` = `'""'` → `getIdempotentResult` 返回 `''`（falsy）→ 调用方 `if (cached)` 跳过重放 → `acquireIdempotentKey` NX 失败 → **60s 内重试一律 `status(200,'重复请求')`**，重放机制完全失效（机制已核对 kv.ts:304-330）。

| 位置 | 操作 |
|---|---|
| `media/service.ts:107-110` | insertmediatoentry |
| `media/service.ts:153-156` | delemediatoentry |
| `strategy/service.ts:194-197` | strategyListUpdate |
| `strategy/service.ts:241-244` | strategyListCreate |
| `strategy/service.ts:266-269` | strategyListDelete |
| `strategy/service.ts:374-377` | adminChangeStatus |

对照组：`games/service.ts:834-837`、`media/service.ts:197-200,227` 存真实数据，重放正常——证明这是「存 `''`」路径的缺陷而非工具函数缺陷。

### 1.4 高 — 删除媒体后缓存不失效：已删图片最长残留 6h

`media/service.ts:118-164` `delemediatoentry` 删除 `otherMedia`/`mediaTable` 后**无任何 delKv**。`galzy:game:info:*`（6h TTL）、`galzy:game:list*`（2h）、`galzy:tag:games:*`（1h）中的 `other_media` 继续返回已删除图片。（子代理核验）

### 1.5 高 — 删除攻略后详情缓存不失效：已删文章最长返回 1h

`strategy/service.ts:247-269` `strategyDelete` 只清 `galzy:game:strategys:*` 与 `admin:articles:*`，**漏清 `galzy:strategy:${strategyId}`** → 已删除攻略的详情页继续 200（应 404）最长 1h。（子代理核验）

### 1.6 高 — 标签编辑后缓存不失效：旧名/旧展示状态最长 1h

`tags/service.ts:370-380` `tagEdit`、`405-424` `tagFileAdd` 修改 zhtags 后除 CDN purge 外无 delKv。`galzy:tag:*`（1h）、`galzy:game:tags:*`（1h）、`galzy:tags:categories:v4`（1h）残留旧值。（子代理核验）

### 1.7 中高 — `/api/game` 错误响应被二次包装：400 变 200 + `{}`

`apps/web-tanstack/src/routes/api/game.ts:126-127`

```ts
GET: async ({ request }) => {
  ...
  const data = await getData(vid);
  return jsonResponse(data);   // getData 错误路径返回的已是 Response
}
```

`getData` 错误路径返回 `jsonResponse(vltdma.getMessage('notFound'), 400)`（L31、L42），外层再 `JSON.stringify(Response)` 恒得 `"{}"` → **游戏不存在/无文件时实际返回 HTTP 200 + `{}`**，`vltdma.getMessage` 判断逻辑完全失效。已确认 handler 与 getData 对照。

### 1.8 中高 — `/api/game` 并发错误只检查一路

同文件 L24-27 `Promise.all` 三个调用，仅检查 `gameResp.status`（L30）；`fileListResp`（L40-42）与 `strategyList`（L47）错误未处理 → 文件接口 5xx 时 `fileListResp.data` 为 null，被 `!openlist?.length` 误判为「此游戏没有文件」。（子代理核验 + 逻辑自洽）

### 1.9 中 — `/api/search` 错误被吞 + 错误结果缓存 5 分钟

`apps/web-tanstack/src/routes/api/search.ts:6-9,22-25`

只解构 `{ data }`，`error` 丢弃；`if (error)` 分支是死代码（Eden 不 throw）。API 故障 → 返回 200 + `null`，且被 `Cache-Control: public, max-age=300` 缓存 5 分钟，前端把失败当空结果。（子代理核验）

### 1.10 中 — 保存资料失败时 `toast` 未定义 → ReferenceError

`apps/web-tanstack/src/components/user/ProfileMenu/ProfileTab.tsx:118`

```ts
} catch {
  toast.error("保存失败，请重试");   // toast 未 import（文件顶部无 sonner 导入）
}
```

保存失败时 catch 里抛 `ReferenceError: toast is not defined`，错误提示自身崩溃。已确认 imports。

### 1.11 中 — 游戏列表日期范围筛选静默失效

`apps/web-tanstack/src/routes/games/index.tsx:57,103` loader/queryFn 传 `startDate/endDate` 给 `getGameList`，但 `apps/web-tanstack/src/server/game/index.ts:76-88` 的 validator 无这两个字段 → Zod 默认剥离未知键 → **筛选条件永远到不了 API**，日期筛选 UI 无任何效果。已确认 validator 与调用方对照。

### 1.12 中 — 搜索页 `data.searchdata` 可能解引用 undefined

`apps/web-tanstack/src/components/home/search/meilisearch.tsx:36` — 响应类型为 `undefined`（Eden `{}` 退化 + 可能 null），`data.searchdata` 在 API 返回 null 时抛 TypeError。（类型证据 + 同文件 L73-74 的 string|undefined→string）

### 1.13 中 — cron Meili 索引更新后不清 `galzy:search:*`（新数据最长 1h 搜不到）

`cron/service.ts` 重建/增量后只 purge CDN，不清搜索缓存；`vndb-sync.invalidateCache` 却会清 `galzy:search:*` → 两条数据管道失效行为不一致。（子代理核验）

### 1.14 中 — 下载计数缓存最长 2h 不更新

`download/service.ts:26-30` `DownloadGet` 写 `gameDownloadStats` 无失效；games List 的 `dl_count` 内联该表 → 列表下载数最长 2h 落后。（子代理核验）

### 1.15 低 — `VidassociationGet`（GET）带写副作用且不清缓存

`games/service.ts:759-767,784-793` GET 请求内 insert + update 建关联，无任何 delKv → `galzy:game:info:*`/`list*` 与实际库不一致最长 6h。属架构坏味道 + 数据一致性问题。（子代理核验）

### 1.16 低 — 幂等冲突用 `status(200, '重复请求')`

`games/service.ts:815` 等：HTTP 200 携带错误语义，客户端 `res.ok` 判定为成功，需检查 `value.message` 才能识别。（子代理核验）

---

## 二、类型健康（tsc 全红，但不阻断运行）

- `bunx tsc -p apps/api/tsconfig.json` → **4 错误**：`games/service.ts:757,768,782,793` 事务参数 `PgTransaction` 缺 `$client`（`fetchData(tx = db)` 默认参数类型推导所致；运行时有 `.query`，无碍）。
- `bunx tsc -p apps/web-tanstack/tsconfig.json` → **214 错误**，~65 个文件，两大类别：

### 2.1 主因：Eden Treaty 响应类型退化为 `{}`（约一半错误）

`GameHeader.tsx`（16）、`GameInfo.tsx`（22）、`cmments/index.tsx`（8）、`topics/$topicId.tsx`（5）、`$id/_layout.tsx`（4）、`server/game/index.ts`（6）等全部是 `Property 'vn'/'producers'/'comments'/'gamelist' does not exist on type '{}'`。**API 返回契约在 web 侧没有任何类型保障**，`1.11` 的 startDate 剥离、`1.7` 的双重包装这类契约错误就是这样漏进来的。排查方向：`apps/api/src/index.ts` 的 `export type app = Awaited<ReturnType<typeof buildApp>>` 与 `@elysiajs/eden` 的推断（含 `.use(openapi())` 对推断的影响）、以及服务层返回类型。

### 2.2 次因：Better Auth / 组件类型缺口

- `session.user.role`（auth/index.ts:71、collections、comments、strategy、topics）——**运行时有 `admin()` 插件注入 role，非运行期问题**，仅类型增强缺失。
- `socialProviders.*.clientId/clientSecret`、`MEILISEARCH_INDEXNAME`/`TAG_INDEXNAME`、`EMAIL_KEY` 等 env `string|undefined`——类型；**但注意 `meilisearch/index.ts:8` 构造无兜底，env 缺失时模块顶层即崩、API 起不来**；`search/service.ts:242` 等 5 处 `MEILISEARCH_INDEXNAME` 无 `|| ''` 兜底（`searchTags` L269 却有）——env 处理不一致。
- `auth.service.ts:284-285` `generateOpenAPISchema` —— `openAPI()` 插件已启用，运行时有。
- 路由 `server: { handlers }` 选项（api/auth/$.ts、api/game.ts、api/health.ts、api/search.ts、api/upload）——框架类型未收录，但**实测运行正常**（见第四节）。
- admin 页 setState 泛型（collections-page/articles-page/comments-page/users-page 的 `string|null` vs `string`）——base-ui Select 实际不产生 null，低危。
- 死代码：`hooks/useForesight.tsx`（`js.foresight` 模块不存在，未被引用）、`header-user.tsx`（Sign in 链接指向不存在的 `/demo/better-auth`，组件未被挂载）、`collections-page.tsx:738` `vidInput/setVidInput` 未使用。

---

## 三、工程配置

1. **嵌套 biome.json 冲突**：`apps/web-tanstack/biome.json` 与根 `biome.json` 都是 root 配置 → 根目录执行 `biome check` 直接报错退出（实测）。且风格分裂：web 用 tab + 双引号（vcs 关闭），根用 2 空格 + 单引号 → 两端格式漂移，编辑器/CI 在根级集成会挂。
2. **无测试防线**：全仓仅 `SmartMarkdown.test.tsx` 一个测试；API 零测试。214 个类型错误 + 上述运行期 BUG 没有任何 CI 拦截（构建不 typecheck）。这与 AGENTS.md 宣称的「测试已声明未实现」一致。

---

## 四、已实测排除（非 BUG）

| 疑点 | 结论 |
|---|---|
| `/api/auth/*`、`/api/health`、`/api/upload` 的 `server: { handlers }` 代理 | 启动 vite dev 实测 `/api/health` → 200 `{"ok":true}`，**运行正常**，仅类型未收录 |
| admin 守卫 `session.user.role` | `admin()` 插件自动注入 role 字段，schema 也有 role 列，运行期正常 |
| BFF server/ 层契约（19 文件） | 子代理逐文件核验：elysiaErrorF / cookiePass / validator 全部合规，无缺失 |
| games List 缓存失效集 | `vidassociationUpdate` 的 delKv 集基本完整（除 `galzy:tag:games:*` 外） |

---

## 五、修复优先级建议

1. **P0**（错误数据/重复数据）：1.1 缓存键冲突、1.2 vidassociationCreate 键写错、1.3 六处存空串、1.4/1.5/1.6 删除/编辑不失效。
2. **P1**（功能失效）：1.7 /api/game 双重包装、1.9 /api/search 吞错、1.10 toast、1.11 日期筛选、1.12 搜索页 undefined。
3. **P2**（一致性）：1.13/1.14 缓存清理缺口、1.15 GET 副作用、1.16 200 错误语义。
4. **P3**（类型防线）：修 Eden `{}` 退化（2.1）→ tsc 归零 → CI 加 typecheck；env 兜底统一；biome 嵌套配置清理；删死代码。

---

## 六、修复记录（2026-08-24 同日完成）

全部 P0/P1/P2 运行期 BUG 已修复；P3 类型健康 214→10（剩余均为 vendored animate-ui 版本漂移 9 处 + 用户未提交的 vite.config.ts 1 处）。

### 已修复（含文件）

| 报告项 | 修复 |
|---|---|
| 1.1 缓存键冲突 | `games/service.ts` List cacheKey 恒含 `:${sortBy ?? 'id'}:${order}` |
| 1.2 vidassociationCreate 幂等键 | store 改回 `galzy:idempotent:vidassociationCreate:action`，TTL 60s |
| 1.3 空串幂等存储 | media×2 / strategy×4 全部改为存 `{ success: true }` 并返回；media insert 的 existingRelation 分支也补了 store+return |
| 1.4 media 删除缓存失效 | 新增 `invalidateOtherCaches()`（alistb 反查 vid + info/list/tag:games 三组键）；getMediaByCover 同用 |
| 1.5 strategy 删除缓存 | strategyDelete 补 `delKv('galzy:strategy:${strategyId}')` |
| 1.6 tags 编辑缓存失效 | tagEdit/tagFileAdd 补 `galzy:tag:*` / `galzy:game:tags:*` / `galzy:tags:categories:v4` 失效 |
| 1.7/1.8 /api/game | GET handler 透传 Response（不再二次包装）；fileListResp 错误→502；strategy 失败→`?? []` |
| 1.9 /api/search | 丢弃 tryit 死代码；error 显式处理→502，不再缓存错误结果 |
| 1.10 ProfileTab | 补 `import { toast } from 'sonner'` |
| 1.11 日期筛选 | server/game validator + 透传 startDate/endDate 到 `api.search.games`（搜索侧本就支持 released_first 过滤） |
| 1.12 搜索页 undefined | 死组件 `meilisearch.tsx` 已删除（路由恒 redirect 到 /games，从未渲染） |
| 1.13 cron 搜索缓存 | 三个 Meili 重建完成点补 `delKvPattern('galzy:search:*')` |
| 1.14 下载计数 | 统计写入后 `delKvPattern('galzy:game:list*')` |
| 1.15 GET 副作用 | VidassociationGet 懒建分支补失效；缺失时改抛 404（原 v 分支会 500 崩溃） |
| 1.16 200 错误语义 | 10 处 `status(200,'重复请求')` → `409` |

### 类型健康（P3）

- **Eden `{}`/`unknown` 退化根因已定位并修复**：Elysia 响应推断在两种情况下塌缩——①handler 返回类型含 `any`（服务层 `return JSON.parse(...)` 未断言）；②返回类型含 `| null | undefined` 联合。修复：InfoGet/Relations 的 JSON.parse 路径显式断言（`as InfoResult`/`as RelResult`，局部类型别名前向引用），VidassociationGet 改 404 + 非空返回。
- **TanStack ServerFn 可序列化检查**：unknown 字段（sql 模板/jsonb 列）会令 `ValidateSerializableMapped` 失败、下游类型退化为 `{}`。新增 `@web/lib/serializable.ts` 的递归 `StripUnknown<T>`，对 7 个 server fn 的返回值定型；tags/producer 的 sql 模板补了具体泛型。
- 214 处 web 类型错误 → **10**（animate-ui vendored 9 + vite.config 1）；API 4 → **0**。
- Biome 嵌套配置冲突：web 规则合并进根 `overrides`，删除 `apps/web-tanstack/biome.json`，根目录 `biome check` 恢复可用。
- 死代码删除：`useForesight.tsx`、`header-user.tsx`、`home-game-list.tsx`（含潜在首页崩溃）、搜索组件。
- env 兜底统一：MEILISEARCH_HOST/MASTER/INDEXNAME/TAG_INDEXNAME、EMAIL_KEY、WEB_HOST、OAuth clientId/secret。

### 验证

- `tsc -p apps/api/tsconfig.json`：**0 错误**（修复前 4）
- `tsc -p apps/web-tanstack/tsconfig.json`：**10 错误**（修复前 214；剩余均为 vendored animate-ui 与用户未提交文件）
- `oxlint`：0 告警；Vitest：**11/11 通过**
- `/api/health` 实测 200（修复前已测，`server` 路由选项确认运行正常）
- 说明：远端 PostgreSQL（23.80.83.199）本次不可达，API 全链路冒烟未能执行；涉及 DB 的变更已通过 tsc + 逐行核对验证。
