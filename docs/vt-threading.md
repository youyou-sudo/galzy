# VT 动画的线程模型与本轮优化（ADR）

> 结论先行：**原生 View Transition 的动画帧由浏览器合成器线程产生，Worker 既无法接管、也不应接管。**
> 本文档记录三轮优化：① 把 VT 窗口内**唯一还能被脚本削减的主线程工作**（`ready` 阶段的 group
> 关键帧改写 pass）在多数设备上降到零 / 去掉强制布局；② 交互优先 + 动画窗口零提交
> （reduced-motion 直通、输入即时打断、ThumbHash 占位提交门控）；③ 把动画窗口内剩下的工作
> 全部推迟或错峰（预取暂停、收尾提交错峰、首屏外延迟渲染、VT 期间关模糊、触屏时长收紧）。

## 1. 为什么「把 VT 动画搬到 Worker」不可行

### 1.1 没有可用的 API 面

- Worker 里没有 `document` / DOM。`ViewTransition` 只能由 `document.startViewTransition()` 创建。
- `::view-transition`、`::view-transition-group(name)`、`-image-pair`、`-old`、`-new` 全部是 **UA 生成的伪元素**：
  脚本不能创建、不能查询、不能持有；对应的 `Animation` / `KeyframeEffect` 只存在于页面的动画时间线上，
  只能通过 `document.getAnimations()` 从主线程拿到。Worker 没有任何等价入口。
- 因此「在 Worker 里计算并渲染 VT 动画」在当前 Web 平台上不存在实现路径，不是性能取舍问题。

### 1.2 动画本来就不在主线程

`src/lib/view-transition.ts` 的改写目标就是把 group 关键帧收敛成纯 `transform` / `opacity`
（见 `makeGroupCompositorKeyframes` 注释与 `styles.css` 中「跑在合成器线程（120/144Hz）」的说明）。
改写生效后，动画帧由合成器线程驱动：**不占主线程**。Worker 化不会让它更快。

### 1.3 用 Worker + OffscreenCanvas 自绘替代，只会更卡

要自绘「旧页 → 新页 + 共享元素飞行」，必须先把两端 DOM 光栅化成位图（html2canvas 类方案）：
光栅化本身在主线程、受 CORS/字体/滤镜/混合模式限制，保真度显著下降，还要重写全部共享元素配对、
文字等比保护、跳过策略等逻辑。等于用更大的主线程开销换一个更差的动画。

## 2. 一次导航里，主线程到底在做什么

| 阶段 | 执行者 | 能否移出主线程 |
| --- | --- | --- |
| `startViewTransition()` 的 update callback（React 提交新路由） | 主线程 | 不能（DOM/React） |
| 新旧状态快照采集（整页光栅化） | 浏览器渲染管线 | 不能（无 API 暴露） |
| `ready` 之后的 tracker 改写 pass | 主线程脚本 | **本轮优化对象** |
| 动画播放（group / image-pair / old / new） | 合成器线程 | 已经不在主线程 |
| `finished` 之后收尾（揭示门控 flush、滚动校正） | 主线程 | 需要 DOM，不能整体移出；已由 `reveal-gate` 让位 |

也就是说：**VT 动画本身没有「主线程渲染」可搬；能搬的只有 tracker 那次一次性脚本 pass。**

## 3. 已落地的优化（三轮）

### 第一轮：削减 tracker 主线程成本（4 个文件）

### 3.1 短路：CSS 已覆盖 UA group 动画时，整条 pass 直接跳过

`styles.css` 里有两条分支会让 UA 生成的 group 动画被完全覆盖：

1. `@media (pointer: coarse)` + `@supports not (view-transition-class: x)`
   （低端 Android WebView / Chrome 111–124）：`::view-transition-group(*)` 被替换成
   `galzy-vt-group-fade`（纯 opacity），root group 无动画；
2. `@media (prefers-reduced-motion: reduce)`：所有 group duration `0s`、old/new `animation: none`。

这两种情况下 width/height 插值根本不会跑，改写纯属浪费。现在 `shouldSkipGroupRewrite()`
逐条镜像上述媒体查询，命中时**连 `document.getAnimations()` 都不调用**。
这是本轮对「低端机掉帧」最直接的收益：VT 窗口内 tracker 主线程开销归零。

### 3.2 用 `KeyframeEffect.target` 替代全 DOM 属性扫描（条件收益）

旧实现每次导航都执行 `querySelectorAll('[style*="view-transition-name"]')`。现在优先用
`effect.target`，且必须满足 `el.style.viewTransitionName === group name` 才采用；不匹配（含规范上
伪元素 originating element 指向根元素的情况）时回退到原扫描，行为与旧实现一致。

### 3.3 惰性测量：新版 UA 形态零 `getBoundingClientRect`

只有「非 root group 且 from 关键帧带可解析 width/height」（旧版 UA 形态）才需要实测新尺寸来折算
`scale`；旧实现对所有共享元素 eager 测量。现在新版 UA（关键帧已把尺寸折进 transform）完全不测量，
文字类判定的 `style` 读取提前到测量之前。

不变项：`MAX_REWRITE_GROUPS = 64`、成功才计数、失败只 `console.warn` 一次、跳过 text group、
删除 to 关键帧 transform、root group 特判——全部保持。

### 3.4 `root-provider` 的 VT 播放探测改为 O(1)

持久化 flush 前原本用 `document.getAnimations()` 全量枚举判断「是否有 `::view-transition` 动画在跑」。
现在优先用 `:active-view-transition` 伪类匹配（`documentElement.matches`，O(1)）；伪类不可用时
回退到原枚举逻辑（逐字等价），保证旧 UA 行为不变。

### 第二轮：交互优先与动画窗口内的零提交

#### 3.5 `prefers-reduced-motion` 直通：省掉两次整页快照采集

`styles.css` 在 reduced-motion 下已把所有 VT 动画压到 `0s` / `none`，视觉上没有动画收益，但
`document.startViewTransition()` 仍要采集新旧两帧整页快照（真实主线程光栅成本）。现在 tracker 包装层
命中该媒体查询时直接执行 update 回调、不调用原生 VT，返回 duck-typed `ViewTransition`
（`updateCallbackDone` 保留异常透传，Router 只 await 它）。`activeTransition` 不写入。

#### 3.6 用户输入即时打断：交互优先

新快照是固定覆盖层，动画播放中滚动/点按会看到「页面没动」。现在真实 transition 启动后
（起始手势的 `pointerdown` 已派发过，不会误杀），在 `document` 上挂
`capture + passive + once` 的 `pointerdown` / `touchstart` / `wheel` / `keydown`：任一输入立即
`skipTransition()`，`finished`（resolve/reject）后幂等清理监听。

#### 3.7 ThumbHash 占位提交纳入 `reveal-gate`

真实图揭示早已走 `gateCommit`，占位图这条路径之前是直接 `setState`：滚动或 VT 进行中，每张卡的
占位图换帧都会把提交洒进滚动帧/动画帧。现在 `useThumbHashDataUrl` 的解码结果也交给 `gateCommit`
（未门控时同步提交，门控中挂起、由门控调度器分片 flush），卸载/thumbhash 变化时取消挂起提交。

#### 3.8 为什么没有把动画搬到 Worker

见 §1：没有 API 面；动画本来就在合成器线程；自绘替代更贵更差。

### 第三轮：把动画窗口内剩下的工作推迟或错峰

#### 3.9 VT 播放期间暂停视口/空闲预取

新页卡片进入视口会触发 `preloadRoute`（动态 import + server fn + 路由缓存写入），这些工作
之前会在 VT 播放期间与动画抢主线程。现在 `useViewportPreload` / `useIdlePreload` 在
`isViewTransitionActive()` 期间只把任务排进等待队列，VT 结束那一帧再恢复派发（rAF 轮询 +
1500ms 兜底）；`useIntentPreload` 走同一调度入口，hover 预取一并顺延。并发上限、取消语义、
「加载更多」全局暂停逻辑全部保持。

#### 3.10 收尾提交错峰：`commitAfterViewTransition`

详情页的封面 / 标签 / 文件列表等组件都要「等 VT 结束再提交」。现在统一走
`commitAfterViewTransition(commit)`：VT 结束后在微任务里立即放行第一片（≤6，不增加首条
延迟），剩余按 `FLUSH_CHUNK_SIZE` 每帧一片；1500ms 兜底强排，返回取消函数供卸载时移出队列。
与滚动门控共用同一条分片节奏（`drainChunk`），两套队列相互独立。

#### 3.11 首屏外静态区块延迟渲染：评估后**否决**

原计划给首页「本周热门 / 精选合集」加 `content-visibility: auto` +
`contain-intrinsic-size: auto 360px`，减少新页提交期的排版。落地并验证后发现两个硬伤：

1. 这两个区块处在 SPA **返回滚动恢复**路径上：区块未渲染时高度只取兜底值
   （真实高度随断点约 700–1300px 变化），返回首页时文档总高偏小 → 滚动恢复落点偏移，
   区块随后渲染再跳一次；
2. 兜底高度无法用单一数值覆盖 3/4/6 列三种断点。

这与「不能影响主要交互」冲突，已撤回（`styles.css` 保留一段说明，避免后来者重踩）。
若将来要用：只放在**不会被返回滚动恢复命中的区块**上，并让
`contain-intrinsic-size` 尽量接近真实高度；虚拟化卡片网格永远不要加。

#### 3.12 VT 期间关闭背景模糊（`.galzy-vt-no-blur`）

`backdrop-filter` 每帧都要重算背面采样。VT 播放期间只对显式声明 `.galzy-vt-no-blur` 的元素
（顶栏玻璃药丸）关掉模糊；不用 `*` 选择器，避免伪类翻转触发全站样式失效。新旧两帧快照都在
伪类生效期间采集，过渡两端一致，动画结束后模糊自动恢复。

#### 3.13 触屏 group 时长 250ms → 200ms

`@media (pointer: coarse)` 内 `::view-transition-group(*) { animation-duration: 200ms }`：
少 3–4 帧，掉帧概率下降；`.article-title` / `.producer-name` 的 220ms 特异度更高，不受影响；
旧 UA 的 `galzy-vt-group-fade 160ms` 简写仍覆盖本规则。

## 4. 让 VT 更流畅的杠杆清单（按性价比排序）

### 4.1 先定位掉帧发生在哪一段

用 Chrome DevTools Performance 录一次导航，看掉帧落在：

| 掉帧位置 | 说明 | 对应杠杆 |
| --- | --- | --- |
| 动画开始前（点击后 ~0–200ms） | 旧快照采集 / 新页 React 提交 / 数据未就绪 | §4.2 快照成本、§4.3 提交成本、预取 |
| 动画播放中 | 关键帧仍含 width/height（布局动画）、滤镜/模糊/混合模式 | §4.4 合成器友好 |
| 动画结束后 | 收尾提交尖峰（大图换帧、滚动校正、门控 flush 同时放行） | §4.5 错峰 |

### 4.2 降低快照绘制成本（低端机最大杠杆）

| 措施 | 现状 | 取舍 |
| --- | --- | --- |
| 大图在 VT 期间降级为 ThumbHash 占位 | 已实现（`GameHeader`） | 无 |
| 卡片只给被点的那一张挂 `view-transition-name` | 已实现 | 无 |
| root 快照混合模式 `normal`（去掉 plus-lighter 加色） | 已实现 | 无 |
| 新页首屏外静态区块 `content-visibility: auto` + `contain-intrinsic-size` | **评估后否决**（§3.11） | 会破坏返回首页的滚动恢复（兜底高度 ≠ 真实高度），与「不影响主交互」冲突 |
| VT 期间关闭 `backdrop-filter`（顶栏玻璃药丸） | 已落地（§3.12） | 过渡瞬间顶栏变实心，需要视觉确认 |
| 避免在 VT 窗口内触发大范围样式重算（换主题、字体切换） | 需注意 | 无 |

### 4.3 降低 VT 窗口内的主线程提交

| 措施 | 现状 |
| --- | --- |
| tracker 改写 pass 短路 + 惰性测量 | 已落地（§3.1–3.3） |
| 真实图揭示提交门控 | 已实现 |
| ThumbHash 占位提交门控 | 已落地（§3.7） |
| 查询缓存持久化避让 VT + O(1) 探测 | 已落地（§3.4） |
| 视口预取在 VT 期间暂停派发 | 已落地（§3.9）：预取全是后台工作，延后 ≤250ms 用户无感 |
| 动画结束后的收尾提交错峰 | 已落地（§3.10）：`commitAfterViewTransition` + 三个详情页组件接入 |

### 4.4 合成器友好

| 措施 | 现状 |
| --- | --- |
| group 关键帧只剩 transform/opacity | 已实现（改写） |
| 触屏旧 WebView 收敛为纯 opacity 淡入、root 无动画 | 已实现（CSS） |
| 触屏 group 时长从 UA 默认 250ms 收到 200ms | 已落地（§3.13）：少 3–4 帧，代价是动画稍快 |
| 文本共享元素 `object-fit: scale-down` 等比保护 | 已实现 |

### 4.5 交互优先

| 措施 | 现状 |
| --- | --- |
| 新导航立即 skip 旧 VT | 已实现 |
| 动画中任一用户输入立即 skip | 已落地（§3.6） |
| `prefers-reduced-motion` 绕过原生 VT | 已落地（§3.5） |
| 导航期间页面保持可点击（无全屏遮罩拦截） | 已实现（快照伪元素不接管事件） |

### 4.6 不建议的做法

- 用 Worker + OffscreenCanvas 自绘 VT（§1.3）：快照光栅化仍要主线程，保真度下降。
- 把 `setTimeout` / `rAF` 调度搬进 Worker：回调最终回主线程，多一次消息往返且失去帧对齐。
- 给列表每张卡挂 `view-transition-name`：快照数与 tracker 扫描随页数线性爆炸。
- 动画窗口内做 `JSON.stringify` / 大批量 `setState`：直接表现为掉帧或长任务。

## 5. 真机验证方法

在页面导航前粘贴到控制台，观察 VT 窗口内的主线程长任务与 tracker 耗时：

```js
// 1) 统计 VT 窗口内的 longtask（主线程被占用的证据）
const po = new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    console.log("[vt] longtask", e.duration.toFixed(1), "ms", e.name);
  }
});
po.observe({ type: "longtask", buffered: false });

// 2) 包一层 startViewTransition，量脚本耗时与动画总时长
const orig = document.startViewTransition?.bind(document);
if (orig) {
  document.startViewTransition = (cb) => {
    const t0 = performance.now();
    const vt = orig(cb);
    vt.ready.then(() =>
      console.log("[vt] ready 前主线程脚本", (performance.now() - t0).toFixed(1), "ms"),
    );
    vt.finished.then(() =>
      console.log("[vt] 动画总时长", (performance.now() - t0).toFixed(1), "ms"),
    );
    return vt;
  };
}
```

期望：desktop 上 `ready 前主线程脚本` 只剩亚毫秒级；低端 Android WebView（111–124，`pointer: coarse`）
上 tracker 改写不再出现在 longtask 列表中。

## 6. 如果目标仍是「继续把东西下沉到 Worker」

VT 本身没有可下沉的面，但同一份「减少卡顿」的预算可以投到真正的主线程长任务上：

- **图片解码 / ThumbHash**：已有 `src/lib/thumbhash.worker.ts` 先例（IDCT + PNG 编码全在 Worker）；
  同一条思路可继续覆盖占位图/缩略图的离屏光栅化（`OffscreenCanvas`）。
- **查询缓存序列化**：`root-provider` 的 `JSON.stringify(slimClientForPersist(client))` 是真实长任务，
  目前靠「避开 VT 窗口 + rIC 合并写」缓解；把序列化放进 Worker（回传字符串、主线程只做 `setItem`）
  是可行的下一步。
- **不要**把 `setTimeout` / `rAF` 调度搬进 Worker：回调最终仍要在主线程执行，只会多一次消息往返，
  并失去与渲染帧对齐的能力（本仓库 `skipViewTransitionsForModal`、`reveal-gate` 的分片 flush 都依赖帧对齐）。

## 7. 残余风险与回滚

| 风险 | 说明 | 处置 |
| --- | --- | --- |
| 触屏 + `@supports not (view-transition-class)` 设备 | JS 短路依赖「CSS 已把 group 动画覆盖为纯 opacity」；理论上 UA 实现差异可能让两层动画并存 | 建议低端 Android WebView 真机冒烟一次 |
| `effect.target` 快速路径 | 规范上伪元素 originating element 为根元素，快速路径大概率不命中 | 不命中即回退原扫描；命中也有 `viewTransitionName === name` 保护 |
| reduced-motion 直通 | 不再产生 `:active-view-transition`：依赖它的 gate（`GameHeader` 的 `vtPending`、`reveal-gate`、`root-provider` 探测）会走「无 VT」分支；视觉上 reduce 本就没有动画 | 真机 reduce 模式冒烟一次；dev 版 `capability-probe` 会把 duck 对象报成「VT 可用」，属诊断口径偏差，可后续修正 |
| 输入打断 | 动画播放中任何 `pointerdown` / `wheel` / `keydown` 会立即切到新页（这是有意的交互优先取舍，不是丢帧） | 真机确认点击/滚动手感；若觉得太激进，可只保留 `pointerdown/wheel` |
| ThumbHash 占位门控 | VT/滚动期间未缓存的占位图会延后到门控解除（重试链 ~80ms，兜底 1500ms） | 低端机冒烟确认占位出现时机；`GameHeader` 有骨架底兜住 |
| 预取暂停 | VT 期间不派发新预取（最多 1500ms 兜底恢复）；用户若在动画结束后立刻点击未预取卡片，秒开率略降 | 冒烟：VT 结束后预取是否补发、首屏图片带宽竞争是否变差 |
| 收尾提交错峰 | 当前只有 3 个组件接入（≤6），首片仍会被 React 批处理成一次渲染；分帧只在对列 >6 时生效 | 后续更多组件接入时观察动画结束后是否仍有长任务 |
| 首屏外延迟渲染 | 已撤回：`content-visibility: auto` 的兜底高度会破坏返回首页的滚动恢复 | 无需冒烟；若将来重启需先解决恢复落点 |
| VT 期间关模糊 | 过渡瞬间顶栏从玻璃变实心（约 200ms） | 视觉确认可接受；不接受就删掉 Header 上的 `galzy-vt-no-blur` |
| 触屏时长 200ms | 比之前少 50ms，观感更「脆」 | 视觉确认；改回 250ms 只需改一条 CSS |
| 回滚 | 涉及 12 个源码/测试文件 + 本文档 | 按轮次 `git checkout` 对应文件即可 |
