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
