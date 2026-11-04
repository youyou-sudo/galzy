import "@teyik0/furin/server-only";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { defineBffNoInput } from "@web/lib/bff/define";
import { cookiePass } from "@web/lib/cookie-pass";

/**
 * Kungal（NextMoe·未萌）目录同步 —— 后台入口。
 *
 * kungal 是当前的主数据源：作品、角色、攻略都只从它取，VNDB 只在作品层做锚点
 * 映射。所有调用都透传当前管理员的 cookie（API 侧还有 isAdmin 二次校验），
 * BFF 自己不做权限判断，避免两处判断漂移。
 */
export const getKungalSyncProgress = defineBffNoInput(async () => {
	const { data, error } = await api["kungal-sync"].progress.get(cookiePass());
	elysiaErrorF(error);
	return data;
});

/** 全量同步：作品 → 角色 → 攻略，一轮到底，最慢。 */
export const triggerKungalFullSync = defineBffNoInput(async () => {
	const { data, error } = await api["kungal-sync"].full.post({}, cookiePass());
	elysiaErrorF(error);
	return data;
});

/** 增量同步：只处理本次新增/变更的作品，并顺带补历史缺口（角色/攻略各有上限）。 */
export const triggerKungalDeltaSync = defineBffNoInput(async () => {
	const { data, error } = await api["kungal-sync"].delta.post({}, cookiePass());
	elysiaErrorF(error);
	return data;
});

/** 只跑角色阶段：作品没变、只想补角色资料时用，不重刷作品。 */
export const triggerKungalCharactersSync = defineBffNoInput(async () => {
	const { data, error } = await api["kungal-sync"].characters.post(
		{},
		cookiePass(),
	);
	elysiaErrorF(error);
	return data;
});

/** 只跑攻略阶段：按 upstream_updated_at 跳过没变的攻略，重复触发很便宜。 */
export const triggerKungalWalkthroughsSync = defineBffNoInput(async () => {
	const { data, error } = await api["kungal-sync"].walkthroughs.post(
		{},
		cookiePass(),
	);
	elysiaErrorF(error);
	return data;
});
