/** 友情链接 DTO（与 API GET /friend-links 返回一致）。 */
export interface FriendLink {
	id: number;
	title: string;
	avatar: string | null;
	href: string;
	description: string | null;
	sortOrder: number;
	createdAt: string | null;
}

/** 公开列表的 query key：路由 loader 与后台的失效逻辑共用，避免两处字面量漂移。 */
export const FRIEND_LINKS_QUERY_KEY = ["friend-links"] as const;

/** 前台页头文案：组件、pending 骨架与 head meta 共用一份，避免三处各写一遍。 */
export const FRIEND_LINKS_PAGE = {
	title: "🐾 喵の朋友们",
	description: "喵世界再大，有缘的小伙伴也能像在身边一样呢",
} as const;
