import { getGameTags } from "@web/server/game";

/**
 * 游戏标签查询配置（从 tags.tsx 抽出）。
 *
 * 原因与 download-options-queries.ts 相同：routes/$id/_layout.tsx 是 route 模块
 * （tsr-split 只拆 component，loader/head 随 routeTree 进 entry chunk），它需要
 * gameTagsQueryOptions 做 prefetch。若该函数从 tags.tsx 导出，rollup 会把被
 * entry 与标签 card split chunk 共用的 tags.tsx 提升到公共祖先（entry），于是
 * CollapsibleTagList / tag-tooltip 等纯 UI 依赖也回到全站首屏 JS。
 * 抽成这个零 UI 依赖的轻量模块后，这些 UI 只随标签 card 的 chunk 加载。
 */
export const gameTagsQueryOptions = (id: string) => ({
	queryKey: ["gameTags", id],
	queryFn: () => getGameTags({ data: { id } }),
	staleTime: 60_000,
});
