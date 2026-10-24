import { getFileList } from "@web/server/game";

/**
 * 文件列表查询配置（从 download-options.tsx 抽出）。
 *
 * queryOptions 提取：供 /$id/_layout loader 在导航关键路径上 prefetchQuery 预热，
 * 与组件内 useQuery 共用同一 queryKey/queryFn，首次进入即缓存命中。
 *
 * 为什么必须独立成文件，而不是留在 download-options.tsx：
 * routes/$id/_layout.tsx 是 route 模块——tsr-split 只把 component 拆成独立 chunk，
 * loader/head 仍随 routeTree 进入 entry chunk。它需要 filelistQueryOptions 做 prefetch；
 * 若该函数从 download-options.tsx 导出，rollup 会把被 entry 与下载 tab split chunk
 * 共用的组件模块提升到公共祖先（entry），于是 download-options 静态依赖的
 * animate-ui / copy-button / motion/react 全部回到全站首屏 JS。
 * 抽成这个零 UI 依赖的轻量模块后，download-options 只被下载 tab 的 split chunk
 * 引用，motion chunk 随之离开首屏。
 */
export const filelistQueryOptions = (id: string) => ({
	queryKey: ["filelist", id],
	queryFn: () => getFileList({ data: { id } }),
	staleTime: 60_000,
	gcTime: 5 * 60_000,
});
