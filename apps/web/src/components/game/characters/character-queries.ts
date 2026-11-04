import { getCharacterInfo } from "@web/server/game";

/**
 * 角色详情查询配置（从弹窗组件抽出，与站点其他 queryOptions 同构）。
 *
 * 弹窗打开时才发请求：名册已经给出姓名/图片/身份，用户点开某人再看资料，
 * 不把整页角色的 view=full 数据塞进首屏。页面全 SSR、服务端无业务缓存，
 * 这里的 gcTime/staleTime 只是客户端会话内的复用（关掉再打开不重复请求）。
 */
export const characterInfoQueryOptions = (characterId: string) => ({
	queryKey: ["characterInfo", characterId],
	queryFn: () => getCharacterInfo({ data: { characterId } }),
	staleTime: 5 * 60_000,
	gcTime: 5 * 60_000,
	// 详情失败给一次自动重试，仍失败则交给弹窗里的「重试」按钮
	retry: 1,
});
