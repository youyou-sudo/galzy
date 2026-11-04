import { defineRoute, notFound } from "@teyik0/furin";
import GameLayoutPage from "@web/components/game/game-layout-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@web/components/shared/breadcrumb";
import {
	canonicalGameId,
	isGameRouteId,
	isSameGameRouteId,
	normalizeGameRouteId,
} from "@web/lib/game-id";
import { Link, redirect } from "@web/lib/nav";
import { useSeedQueries } from "@web/lib/query-seed";
import { gameTitleOf } from "@web/lib/seo";
import { getGameDetail } from "@web/server/game";
import { t } from "elysia";
import type { ReactNode } from "react";

const paramsSchema = t.Object({ id: t.String() });

type GameDetail = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

/**
 * 游戏详情布局：/[id] 及其全部页签（下载/评论/攻略/统计/系列）。
 *
 * loader 只阻塞 game 本体（快速点击时首屏秒出）；tags / filelist 仍由各卡片内的
 * useQuery 懒加载，沿用旧实现的「不进入导航关键路径」设计。
 */
export const route = defineRoute("/[id]/_route")
	.config({ mode: "ssr", params: paramsSchema })
	.loader(async ({ params }) => {
		// 路由身份命名空间见 lib/game-id.ts：vNNN / dNNN（vndb 侧）与
		// kgX（kungal work id，大小写敏感、原样保留）。非法形态直接 404。
		if (!isGameRouteId(params.id)) {
			notFound({ message: "游戏不存在" });
		}
		// v/d 归一为小写；kgX 只归一前缀，work id 保持原样（/kgAbC ≠ /kgabc）
		const requestedId = normalizeGameRouteId(params.id);
		const game = await getGameDetail({ data: { id: requestedId } });
		if (!game) {
			notFound({ message: "游戏不存在" });
		}
		// 契约 §5：canonicalId 是该条目的最终展示身份（有 vndb 锚点 → vNNN，
		// 否则 kgX）。请求 id 与展示身份不一致时（典型：旧的 /kgX 链接已被
		// vndb 锚点收编）302 到最终路由身份，避免别名页留在历史栈里。
		const gameId = canonicalGameId(game, requestedId);
		if (!isSameGameRouteId(gameId, requestedId)) {
			throw redirect({ to: "/:id", params: { id: gameId }, replace: true });
		}
		return { game, id: gameId };
	})
	.layout(({ children, game, id, path }) => (
		<GameDetailShell game={game} id={id} path={path}>
			{children}
		</GameDetailShell>
	));

function GameDetailShell({
	children,
	game,
	id,
	path,
}: {
	children: ReactNode;
	game: GameDetail;
	id: string;
	path: string;
}) {
	// 旧 loader 里 context.queryClient.ensureQueryData(["gameDetail", id]) 的等价物：
	// 在页面组件里播种查询缓存（persist 白名单会把它持久化到 localStorage）。
	useSeedQueries([[["gameDetail", id], game]]);

	return (
		<div>
			<Breadcrumb className="mb-4">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/games" />}>
							全部游戏
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink render={<Link to="/:id" params={{ id }} />}>
							{gameTitleOf(game)}
						</BreadcrumbLink>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<GameLayoutPage game={game} id={id} path={path}>
				{children}
			</GameLayoutPage>
		</div>
	);
}
