/**
 * 游戏详情路由身份（display id）工具 —— 契约见
 * apps/api/src/libs/identity/CONTRACT.md
 *
 * 路由命名空间与大小写语义：
 * - `vNNN` / `dNNN`（vndb 侧）：大小写不敏感，统一按小写比较与回传
 * - `kgX`（kungal 侧）：前缀 `kg` 归一为小写，X 是 kungal work id，
 *   路由层**原样保留**大小写，不在前端猜测/改写它
 *
 * 展示身份由 API 决定：条目有 vndb 锚点必为 `vNNN`，否则 `kgX`；
 * kungal work id 的权威写法也由 API 给出（未知 work 统一小写）。
 * 因此 `/kgAbC` 与 `/kgabc` 这类大小写差异由「API 返回 canonicalId → 前端 302」
 * 收敛，前端只负责「解析合法路由 id + 可选读取 canonicalId + 判断是否 302」。
 */

/** vndb 侧路由 id：v123 / d123（d 为历史前缀，继续支持） */
const VNDB_ROUTE_ID_RE = /^[vd]\d+$/i;

/** kungal 侧路由 id：kg 前缀 + 非空 work id（原样大小写，不含空白） */
const KUNGAL_ROUTE_ID_RE = /^kg(\S+)$/i;

const ANCHOR_KINDS = ["vndb", "kungal", "other"] as const;

export type AnchorKind = (typeof ANCHOR_KINDS)[number];

/** 契约 §5：`/games?id=` 响应新增的身份字段（API 未上线时全部缺省） */
export type GameIdentity = {
	canonicalId?: string;
	displayId?: string;
	anchorKind?: AnchorKind;
	kungalOnly?: boolean;
};

/** URL 段是否能命中 `/$id` 路由（供 params.parse 使用） */
export function isGameRouteId(raw: string): boolean {
	const id = raw.trim();
	return VNDB_ROUTE_ID_RE.test(id) || KUNGAL_ROUTE_ID_RE.test(id);
}

/**
 * 归一化路由身份：v/d 前缀数字转小写；kgX 只把前缀转小写，work id 原样。
 * 非法形态原样返回（由路由匹配决定是否 404，不在这里吞掉）。
 */
export function normalizeGameRouteId(raw: string): string {
	const id = raw.trim();
	if (VNDB_ROUTE_ID_RE.test(id)) return id.toLowerCase();
	const kungal = id.match(KUNGAL_ROUTE_ID_RE);
	if (kungal?.[1]) return `kg${kungal[1]}`;
	return id;
}

/**
 * 两个路由身份是否指向同一条目：v/d 忽略大小写，kg 的 work id 按原样比较
 * （权威写法差异由 API 的 canonicalId + 302 收敛，不在这里折叠）
 */
export function isSameGameRouteId(a: string, b: string): boolean {
	return normalizeGameRouteId(a) === normalizeGameRouteId(b);
}

function asRouteId(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const id = value.trim();
	if (!id || !isGameRouteId(id)) return undefined;
	return normalizeGameRouteId(id);
}

/**
 * 最小适配层：从详情响应里**可选**读取契约 §5 字段。
 * 不依赖 Eden 生成类型 —— API 侧字段可能先于 web 类型更新上线，
 * 缺失时保持 undefined，由调用方回退到请求 id。
 */
export function readGameIdentity(game: unknown): GameIdentity {
	if (!game || typeof game !== "object") return {};
	const raw = game as Record<string, unknown>;
	const anchorKind = raw.anchorKind;
	return {
		canonicalId: asRouteId(raw.canonicalId),
		displayId: asRouteId(raw.displayId),
		anchorKind:
			typeof anchorKind === "string" &&
			(ANCHOR_KINDS as readonly string[]).includes(anchorKind)
				? (anchorKind as AnchorKind)
				: undefined,
		kungalOnly:
			typeof raw.kungalOnly === "boolean" ? raw.kungalOnly : undefined,
	};
}

/**
 * 该条目最终应落在的路由身份：canonicalId 优先；API 未返回时回退请求 id。
 * 只信任路由可表达的形态（vNNN / kgX），避免跳到 `/$id` 无法承载的 id。
 */
export function canonicalGameId(game: unknown, requestedId: string): string {
	return (
		readGameIdentity(game).canonicalId ?? normalizeGameRouteId(requestedId)
	);
}

/**
 * 是否需要 302 到 canonical 路由：需要则返回目标 id，无需跳转返回 null。
 */
export function canonicalRedirectTarget(
	game: unknown,
	requestedId: string,
): string | null {
	const canonicalId = canonicalGameId(game, requestedId);
	return isSameGameRouteId(canonicalId, requestedId) ? null : canonicalId;
}
