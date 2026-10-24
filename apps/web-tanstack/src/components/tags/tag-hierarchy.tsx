import { Link } from "@tanstack/react-router";
import {
	TagTooltip,
	TagTooltipContent,
} from "@web/components/tags/tag-tooltip";
import { Button } from "@web/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { cn } from "@web/lib/utils";
import { tagHeroActions } from "@web/stores/tagHeroStore";
import {
	Hand,
	LocateFixed,
	Maximize2,
	Minus,
	Move,
	Plus,
	X,
} from "lucide-react";
import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export type TagHierarchyNode = {
	id: string;
	name?: string | null;
	zht_name?: string | null;
};

export type TagHierarchyTag = TagHierarchyNode & {
	ancestorPaths?: TagHierarchyNode[][] | null;
	ancestors?: TagHierarchyNode[] | null;
	children?: TagHierarchyNode[] | null;
};

const labelOf = (n: TagHierarchyNode) => n.zht_name || n.name || n.id;

// ---- 几何常量 -------------------------------------------------------------

const NODE_H = 30;
// 固定尺寸：宽度不按文字估算。估算会让同一列里长短不一的标签左右参差，
// 加上整图宽度随标签内容变化，默认缩放每次进标签都不一样 —— 两个都是「不像设计
// 过」的来源。固定宽高后版面是稳定的栅格。
const NODE_W = 132;

const GUTTER_X = 28; // 图与画布边缘的水平留白
const GUTTER_Y = 34;

// ---- 网格布局参数 ---------------------------------------------------------

const ROW_GAP = 12; // 祖先列内相邻两个节点之间的垂直间隙
const ANC_GAP = 26; // 祖先链末节点 → 当前标签左缘
const ANC_LINK = 24; // 祖先链内相邻两节点之间的连线长度
const MIN_READABLE_ZOOM = 0.72; // 全览缩放的下限：低于此值字就糊了，宁可裁一点

// ---- 子标签卡片（子标签唯一的呈现方式）------------------------------------
//
// 子标签一律收进一张卡片，只用**一根**线接过来：卡片里是等宽对齐的小药丸，格子的
// 行列数是算出来的（不是量出来的），所以卡片尺寸确定、缩放确定。
//
// 为什么不是「一个子标签一个节点 + 总线 + 支线」：子标签一多，为了让它们全塞进画布
// 得一路缩到 50% 出头，字全糊了，几十根支线本身也是一片噪点（g96 有 21 个、g835 有
// 80 个）。收进卡片后格子压到 106×24，80 个也只是一张几百像素宽的卡，整图能稳稳
// 保持在 100% 附近；子标签少的时候同一套结构就是一张小卡 —— 形态一致，不必维护
// 两套版式，也不会出现「同一个组件一会儿是零散节点、一会儿是卡片」。
const CARD_BORDER = 1;
const CARD_PAD = 10; // 卡片内边距
const CARD_CELL_W = 106; // 卡片内标签格子的宽
const CARD_CELL_H = 24; // 格子高
const CARD_CELL_GAP_X = 6;
const CARD_CELL_GAP_Y = 4;
// 当前标签右缘 → 卡片左缘，也就是「那一根线」的长度。线上要压「子标签」三个字，
// 所以留得比一般连线宽：中间 CARD_LABEL_W 给字，两侧各剩十几像素的线可见。
const CARD_GAP = 76;
const CARD_LABEL_W = 44; // 「子标签」三个字 + 左右各一点呼吸
const CARD_LABEL_H = 14;
const CARD_MAX_COLS = 7;
const CARD_MIN_COLS = 3; // 列数下限：窄到一两列就成了竖条，三列起才有「一组」的样子
const CARD_TARGET_AR = 1.5; // 卡片自己的目标宽高比：略宽于方

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 1.2;

// ---- 竖版版面（窄屏）------------------------------------------------------
//
// 容器窄于这个宽度就换竖版：横版在这种宽度下取景只能缩到 40% 出头，字糊、框点
// 不中（见 buildStackedGraph）。取 640 是因为它就是横版还读得清的临界点 ——
// 横版要 MIN_READABLE_ZOOM 才放得下，图宽 886px 倒推回容器正好是 640px 上下。
const MOBILE_BREAKPOINT = 640;
const V_GUTTER = 20; // 竖版：左右留白（比横版窄，省下的宽度留给卡片列数）
const V_INDENT = 18; // 竖版：每深一层向右缩进
const V_ROW_GAP = 12; // 竖版：相邻两行之间的垂直间隙
const V_CARD_GAP = 34; // 竖版：当前标签 → 卡片，留出「子标签」三个字
const V_ELBOW = 8; // 竖版：肘线在父级底边上的出线点，距父级左缘多远
const V_CELL_W = 84; // 竖版：卡片格子的宽（四层深时仍放得下两列）

/** 触屏：抬手时累计位移超过这个像素数就算「拖过」，那一次 click 要吞掉 */
const CLICK_SLOP = 6;

/**
 * 画布高度上限。用 CSS 里的 70vh 表达，但取景计算需要 JS 侧的同一个数 ——
 * 不能用「量到的框高」代替，那会形成 自锁（见 naturalH 处的说明）。
 */
const MAX_CANVAS_H_VH = 0.7;

/** 还没量到容器时的兜底宽度。只影响量测之前那一帧，量到之后会重算。 */
const FALLBACK_W = 1180;

const GRID = 26;

const CANVAS_BG = "color-mix(in oklch, var(--muted) 28%, var(--card))";
const DOT = "color-mix(in oklch, var(--muted-foreground) 30%, transparent)";
const SPOTLIGHT =
	"radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 13%, transparent), transparent 58%)";

// ---- 布局 -----------------------------------------------------------------

type GraphNode = {
	id: string;
	label: string;
	x: number;
	y: number;
	w: number;
	current: boolean;
	/** 能否点进该标签详情。未本地化（无中文名）的祖先点进去必然 404，只能作纯文本 */
	navigable: boolean;
};

/** 祖先链上一段连线：父节点左缘 → 子节点右缘，中间的直线上标着层级 */
type GraphLink = { d: string; intoCurrent: boolean };

/** 装子标签的收纳卡片：一张卡装下全部，只用一根线接过来 */
type ChildCard = {
	x: number;
	y: number;
	w: number;
	h: number;
	count: number;
	cols: number;
	/** 格子的宽。横版与竖版取值不同，渲染的 CSS grid 必须跟 buildGraph 算的一致，
	 *  否则格子会溢出一圈、被 overflow-hidden 裁掉。 */
	cellW: number;
	/** 「子标签」三个字压在连线上，这是它占的那块位置 */
	label: { x: number; y: number; w: number; h: number };
};

type Graph = {
	nodes: GraphNode[];
	/** 祖先链（含汇入当前标签的那几段），逐段给主链上的节点用 */
	links: GraphLink[];
	/** 当前标签右缘 → 子标签卡片的主干；中间断开，断口上压「子标签」三个字 */
	trunk: string;
	/** 子标签收纳卡片；没有子标签时为 null */
	childCard: ChildCard | null;
	width: number;
	height: number;
};

/** 极短的水平连线（节点框之间那几十像素） */
function hline(x1: number, x2: number, y: number): string {
	return `M ${x1.toFixed(1)} ${y.toFixed(1)} H ${x2.toFixed(1)}`;
}

type Box = {
	cellW: number;
	cellH: number;
	gapX: number;
	gapY: number;
	maxCols: number;
	targetAr: number;
	/** 整块允许的最大宽度（由「缩到 MIN_READABLE_ZOOM 还放得下」倒推） */
	maxW: number;
};

const boxW = (b: Box, n: number) => n * b.cellW + (n - 1) * b.gapX;
const boxH = (b: Box, count: number, n: number) => {
	const rows = Math.ceil(count / n) || 1;
	return rows * b.cellH + (rows - 1) * b.gapY;
};

/**
 * 「行满换列」铺 count 个格子时该用几列。
 *
 * 两头都要夹：只夹上界（容器宽度）会把窄容器压成 1…2 列的竖条；只夹下界
 * （纯宽高比）会把十几个格子摊成一行 2000px 的横幅。所以先在「缩到可读缩放还
 * 放得下」的列数里筛，再按宽高比取最优 —— 取景因此总是落在可读区间。
 *
 * minCols 是给「子标签很少」兜底的那一档：格子本身又扁又宽（106×24），按宽高比
 * 选出来的最优解会是一列竖排（40 个格子也是一列），看着就不像「一组」。所以
 * 少于 minCols 个时按个数铺满一行，够 minCols 个之后才交给宽高比去算。
 */
function chooseCols(count: number, b: Box, minCols = 1): number {
	if (count <= 1) return 1;
	const fits = Math.max(
		1,
		Math.min(b.maxCols, Math.floor((b.maxW + b.gapX) / (b.cellW + b.gapX))),
	);
	if (count <= minCols) return Math.min(count, fits);
	const shortest = boxH(b, count, fits);
	let cols = fits;
	let best = Number.POSITIVE_INFINITY;
	for (let n = 1; n <= fits; n++) {
		if (n < minCols) continue;
		// 比最扁的那一档还高 60% 以上 = 竖条，淘汰
		if (n < fits && boxH(b, count, n) > shortest * 1.6) continue;
		const dist = Math.log(boxW(b, n) / boxH(b, count, n) / b.targetAr) ** 2;
		if (dist < best) {
			best = dist;
			cols = n;
		}
	}
	return cols;
}

/**
 * 竖版版面（窄屏）：祖先自上而下逐行排（同跳数同缩进）、当前标签接在最后、
 * 子标签卡片再往下，连线走「父级底边下行、再拐进子级左缘」的树形肘线。
 *
 * 为什么窄屏要另起一套：横版那条「祖先链 → 当前标签 → 卡片」是横向摊开的，
 * 手机上整图 730px 宽落进 316px 的容器，取景只能缩到 43% —— 字是 5px、框是
 * 57×13，既看不清也点不中（用户反馈的「手机端无法交互」）。横排的层级在 316px
 * 里没有第二种排法，所以窄屏换竖排：宽度只由最长的一行决定，取景因此能停在
 * 100% 附近，字看得清、节点点得中；真超出画布的部分才交给拖拽/双指。
 */
function buildStackedGraph(
	tag: TagHierarchyTag,
	meta: Map<string, TagHierarchyNode>,
	parentsOf: Map<string, Set<string>>,
	byColumn: Map<number, string[]>,
	isChild: Set<string>,
	maxHop: number,
	children: TagHierarchyNode[],
	availW: number,
): Graph {
	// 行的顺序与缩进都按「根在上、越深的越靠下也越往右」：hop 是到当前标签的
	// 跳数（根最大），所以从 maxHop 往小排。反着排会读成「父级在根上面」，
	// 缩进也会倒过来 —— 父级比子级更靠右，连线全都画不出来。
	const placed: { id: string; x: number; y: number; current: boolean }[] = [];
	let y = GUTTER_Y;
	for (let h = maxHop; h >= 1; h--) {
		for (const id of byColumn.get(h) ?? []) {
			placed.push({
				id,
				x: V_GUTTER + (maxHop - h) * V_INDENT,
				y,
				current: false,
			});
			y += NODE_H + V_ROW_GAP;
		}
	}

	const currentX = V_GUTTER + maxHop * V_INDENT;
	placed.push({ id: tag.id, x: currentX, y, current: true });
	const currentBottom = y + NODE_H;

	// 卡片比节点缩进更深，所以列数只能吃「它自己那一行剩下的宽度」——按容器整宽
	// 算出来的列数会让卡片顶出画布右边。
	const cardX = currentX + V_INDENT;
	const cardBox: Box = {
		cellW: V_CELL_W,
		cellH: CARD_CELL_H,
		gapX: CARD_CELL_GAP_X,
		gapY: CARD_CELL_GAP_Y,
		maxCols: CARD_MAX_COLS,
		targetAr: CARD_TARGET_AR,
		maxW: Math.max(
			V_CELL_W,
			availW - cardX - V_GUTTER - CARD_PAD * 2 - CARD_BORDER * 2,
		),
	};
	// 列数下限降到 2：竖版里每列还要让出缩进与两边留白，硬要三列会把格子挤到
	// 放不下字，不如两列、让卡片高一点。
	const cols = children.length ? chooseCols(children.length, cardBox, 2) : 0;
	const cardW = children.length
		? boxW(cardBox, cols) + CARD_PAD * 2 + CARD_BORDER * 2
		: 0;
	const cardH = children.length
		? boxH(cardBox, children.length, cols) + CARD_PAD * 2 + CARD_BORDER * 2
		: 0;

	const nodes: GraphNode[] = placed.map((p) => ({
		id: p.id,
		label: labelOf(meta.get(p.id) ?? { id: p.id }),
		x: p.x,
		y: p.y,
		w: NODE_W,
		current: p.current,
		navigable: Boolean((meta.get(p.id)?.zht_name ?? "").trim()),
	}));
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	const current = nodeById.get(tag.id);

	// 连线：父级底边 → 下行 → 拐进子级左缘。父级一定在子级上方、且缩进更浅，
	// 所以肘线只在空白处拐弯，不会从任何一个框里穿过去。
	const links: GraphLink[] = [];
	for (const [childId, parents] of parentsOf) {
		if (isChild.has(childId)) continue;
		const to = nodeById.get(childId);
		if (!to) continue;
		for (const parentId of parents) {
			const from = nodeById.get(parentId);
			if (!from || from.y + NODE_H >= to.y) continue;
			const bx = from.x + V_ELBOW;
			if (bx >= to.x - 4) continue;
			links.push({
				d: `M ${bx} ${from.y + NODE_H} V ${to.y + NODE_H / 2} H ${to.x}`,
				intoCurrent: childId === tag.id,
			});
		}
	}

	// 子标签卡片：从当前标签底边中心竖下来，拐到卡片顶边中心。横版是「线在中间
	// 断开、字压在断口上」，竖版没有横线可断：拐点够长就断在拐线上，拐点太短
	// （卡片的列数少、两个中心几乎重合）就把字挪到竖线左边。
	let trunk = "";
	let childCard: ChildCard | null = null;
	let bottom = currentBottom;
	if (current && children.length > 0) {
		const cardY = currentBottom + V_CARD_GAP;
		const gapMid = currentBottom + V_CARD_GAP / 2;
		const nodeCx = current.x + NODE_W / 2;
		const cardCx = cardX + cardW / 2;
		const labelMid = (nodeCx + cardCx) / 2;
		const gapL = labelMid - CARD_LABEL_W / 2;
		const gapR = labelMid + CARD_LABEL_W / 2;
		const bared = gapL > nodeCx + 4 && gapR < cardCx - 4;
		trunk = bared
			? `M ${nodeCx} ${currentBottom} V ${gapMid} H ${gapL} M ${gapR} ${gapMid} H ${cardCx} V ${cardY}`
			: `M ${nodeCx} ${currentBottom} V ${gapMid} H ${cardCx} V ${cardY}`;
		childCard = {
			x: cardX,
			y: cardY,
			w: cardW,
			h: cardH,
			count: children.length,
			cols,
			cellW: V_CELL_W,
			label: {
				x: bared ? gapL : nodeCx - CARD_LABEL_W - 10,
				y: gapMid - CARD_LABEL_H / 2,
				w: CARD_LABEL_W,
				h: CARD_LABEL_H,
			},
		};
		bottom = cardY + cardH;
	}

	const width =
		Math.max(
			...nodes.map((n) => n.x + n.w),
			childCard ? childCard.x + childCard.w : 0,
			childCard ? childCard.label.x + childCard.label.w : 0,
		) + V_GUTTER;

	return { nodes, links, trunk, childCard, width, height: bottom + GUTTER_Y };
}

// 把祖先路径 + 子标签摊成一张三段式版面：祖先链 | 当前标签 | 子标签卡片。
//
// 祖先链按「到当前标签的跳数」分列，同跳同列。用跳数而不是最长路径层级：祖先
// 本来就少（g835 只有 2 个），同跳同列就是最自然的网格语义，也不会把某个节点
// 为了「父必须比子更左」而推到几跳之外去。
//
// 右侧永远是那张卡片：子标签多也好少也好，都收进同一个「分组容器」，只用一根线
// 接过来。所以整张图从左到右只有四个东西 —— 祖先链、当前标签、那根线、卡片 ——
// 连线条数不随子标签数量增长，子标签再多也只是卡片里的格子变多。
//
// 为什么不是放射图：放射布局把几十个子标签摊成六圈同心弧，弧上每个框都占一段
// 角度，圈子越大同样的弧长能装的框越少 —— 于是外圈挤成一团、内圈稀稀拉拉，
// 框与框擦边甚至重叠（用户反馈的「糊成一团」）。
function buildGraph(
	tag: TagHierarchyTag,
	paths: TagHierarchyNode[][],
	children: TagHierarchyNode[],
	availW: number,
): Graph {
	const meta = new Map<string, TagHierarchyNode>([[tag.id, tag]]);
	const parentsOf = new Map<string, Set<string>>();

	for (const path of paths) {
		for (let i = 0; i < path.length; i++) {
			const node = path[i] as TagHierarchyNode;
			if (!meta.has(node.id)) meta.set(node.id, node);
			// 路径是「根 → … → 直接父级」：第 i 个元素的子节点是第 i+1 个，
			// 最后一个元素的子节点就是当前标签本身。
			const childId = path[i + 1]?.id ?? tag.id;
			let parents = parentsOf.get(childId);
			if (!parents) {
				parents = new Set();
				parentsOf.set(childId, parents);
			}
			parents.add(node.id);
		}
	}
	for (const child of children) {
		meta.set(child.id, child);
	}

	const isChild = new Set(children.map((c) => c.id));

	// ---- 祖先链：按到当前标签的跳数分列，跳数相同的一律同列 ----
	//
	// 用跳数（最短距离）而不是 level：祖先数量本来就少（g835 只有 2 个），
	// 「同一跳的节点排在同一列」本身就是网格语义，不需要再为放射图发明层级。
	const hop = new Map<string, number>([[tag.id, 0]]);
	const queue = [tag.id];
	for (let i = 0; i < queue.length; i++) {
		const id = queue[i] as string;
		const next = (hop.get(id) ?? 0) + 1;
		for (const parent of parentsOf.get(id) ?? []) {
			if (hop.has(parent)) continue;
			hop.set(parent, next);
			queue.push(parent);
		}
	}

	const byColumn = new Map<number, string[]>();
	for (const [id, h] of hop) {
		if (id === tag.id || isChild.has(id)) continue;
		const col = byColumn.get(h) ?? [];
		byColumn.set(h, [...col, id]);
	}
	for (const [h, ids] of byColumn) {
		byColumn.set(
			h,
			ids.sort((a, b) =>
				labelOf(meta.get(a) ?? { id: a }).localeCompare(
					labelOf(meta.get(b) ?? { id: b }),
					"zh",
				),
			),
		);
	}
	const maxHop = Math.max(0, ...byColumn.keys());

	// 窄屏换竖版：横版在这种宽度下只能缩到 40% 出头（见 buildStackedGraph）
	if (availW < MOBILE_BREAKPOINT) {
		return buildStackedGraph(
			tag,
			meta,
			parentsOf,
			byColumn,
			isChild,
			maxHop,
			children,
			availW,
		);
	}

	const ancPerCol = Math.max(
		1,
		...[...byColumn.values()].map((ids) => ids.length),
	);
	const chainH = ancPerCol * NODE_H + (ancPerCol - 1) * ROW_GAP;

	// ---- 右侧那张卡片 ----
	//
	// 祖先链最多也就三四列（十几跳），不能让它跟卡片抢宽度 —— 抢了就是
	// 「右边一张孤零零的卡、左边一大片空白」。所以宽度预算先扣掉祖先段，剩下的
	// 给卡片：列数按「缩到 MIN_READABLE_ZOOM 还放得下」倒推，卡片不会横向失控。
	const ancW = maxHop > 0 ? maxHop * (NODE_W + ANC_LINK) : 0;
	// 缩到 MIN_READABLE_ZOOM 后仍要放得下容器 ⇒ 整图宽 ≤ availW / MIN_READABLE_ZOOM
	const budget = Math.max(
		NODE_W * 2,
		availW / MIN_READABLE_ZOOM - (GUTTER_X * 2 + ANC_GAP + ancW),
	);
	// 卡片的内边距与边框要从预算里先扣掉，否则卡片外框会溢出一圈
	const cardBox: Box = {
		cellW: CARD_CELL_W,
		cellH: CARD_CELL_H,
		gapX: CARD_CELL_GAP_X,
		gapY: CARD_CELL_GAP_Y,
		maxCols: CARD_MAX_COLS,
		targetAr: CARD_TARGET_AR,
		maxW: Math.max(
			CARD_CELL_W * 2,
			budget - CARD_GAP - CARD_PAD * 2 - CARD_BORDER * 2,
		),
	};
	const cols = children.length
		? chooseCols(children.length, cardBox, CARD_MIN_COLS)
		: 0;
	// 卡片的尺寸：内边距与边框都算进去（「子标签」三个字压在连线上，不占卡片的高度）
	const rightW = !children.length
		? 0
		: boxW(cardBox, cols) + CARD_PAD * 2 + CARD_BORDER * 2;
	const rightH = !children.length
		? 0
		: boxH(cardBox, children.length, cols) + CARD_PAD * 2 + CARD_BORDER * 2;

	// ---- 坐标：整条版面垂直居中在同一条中线上 ----
	//
	// 所有节点共用一个 y 中线（当前标签），祖先链与子标签卡片各自在自己的方向上
	// 从这条中线向上下展开。于是每条连线都是水平线，没有斜的，也没有任何两条线交叉。
	// 中线要算上 GUTTER_Y：画布高度是「内容高 + 上下各一条留白」，而内容的 y 是从
	// 0 起算的。少了这一条，内容会贴住画布上边缘、两条留白全堆在下面，整块看着
	// 就是「没居中」。（x 方向没这个问题：内容的 x 从 GUTTER_X 起算。）
	const midY = GUTTER_Y + Math.max(chainH, rightH) / 2;
	const placed: { id: string; x: number; y: number; current: boolean }[] = [];

	for (const [h, ids] of byColumn) {
		const colW = ids.length * NODE_H + (ids.length - 1) * ROW_GAP;
		ids.forEach((id, i) => {
			// 列序要按「根在最左、直接父级紧挨当前标签」排。写成 (h - 1) 会把直接
			// 父级扔到最左边、根贴到当前标签旁边 —— 那样从左往右读出来是
			// 「父 → 祖父 → 当前」，正好把层级读反了。
			const x = GUTTER_X + (maxHop - h) * (NODE_W + ANC_LINK);
			placed.push({
				id,
				x,
				y: midY - colW / 2 + i * (NODE_H + ROW_GAP),
				current: false,
			});
		});
	}

	const currentX = GUTTER_X + (maxHop > 0 ? ancW + ANC_GAP : 0);
	// y 是节点框的**上缘**，其余节点都按「各自块的半高」推出来的，所以当前标签
	// 要减掉自己的一半高 —— 否则它整体比中线下沉半个节点，祖先连线与子标签主干
	// 都从它上半部分擦过去，看着就是「没对齐」。
	placed.push({ id: tag.id, x: currentX, y: midY - NODE_H / 2, current: true });

	const cardX = currentX + NODE_W + CARD_GAP;

	const nodes: GraphNode[] = placed.map((p) => ({
		id: p.id,
		label: labelOf(meta.get(p.id) ?? { id: p.id }),
		x: p.x,
		y: p.y,
		w: NODE_W,
		current: p.current,
		navigable: Boolean((meta.get(p.id)?.zht_name ?? "").trim()),
	}));
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	const current = nodeById.get(tag.id);

	// ---- 连线 ----
	//
	// 祖先链：父节点右缘 → 子节点左缘。
	//
	// 判据只能用 x，不能用 y。曾经写成「两节点 y 相同就不画」，本意是躲开同列
	// 纵向堆叠的父子，但同列的两个节点 x 相同、y 不同，那个判据从来没命中过它
	// 想躲的情况；反倒把所有 y 对齐的边（也就是排版正确之后的**全部**祖先边）
	// 全吃掉了。现在只要求父级确实在子级左边、中间留得下一条线。
	const links: GraphLink[] = [];
	for (const [childId, parents] of parentsOf) {
		if (isChild.has(childId)) continue;
		const to = nodeById.get(childId);
		if (!to) continue;
		for (const parentId of parents) {
			const from = nodeById.get(parentId);
			// 父级不在子级左边（重叠或反向）时画不出水平线：那说明两者跨了不止
			// 一列，硬画就是一条从框里穿过去的横线，比不画更糟。
			if (!from || from.x + from.w >= to.x) continue;
			links.push({
				d: hline(from.x + from.w, to.x, from.y + NODE_H / 2),
				intoCurrent: childId === tag.id,
			});
		}
	}

	// 子标签只有一个接法：整张卡片当一个节点，用**一根**线接过来。
	let trunk = "";
	let childCard: ChildCard | null = null;
	if (current && children.length > 0) {
		// 线在中间断开，把「子标签」三个字放在断口上：这样不用给文字垫一块底色
		// 去盖住线，画布上的点阵背景也不会被切出一块补丁。
		const x1 = current.x + NODE_W;
		const mid = (x1 + cardX) / 2;
		const gapL = mid - CARD_LABEL_W / 2;
		const gapR = mid + CARD_LABEL_W / 2;
		trunk =
			gapL > x1 + 4 && gapR < cardX - 4
				? `${hline(x1, gapL, midY)} ${hline(gapR, cardX, midY)}`
				: hline(x1, cardX, midY);
		childCard = {
			x: cardX,
			y: midY - rightH / 2,
			w: rightW,
			h: rightH,
			count: children.length,
			cols,
			cellW: CARD_CELL_W,
			label: {
				x: gapL,
				y: midY - CARD_LABEL_H / 2,
				w: CARD_LABEL_W,
				h: CARD_LABEL_H,
			},
		};
	}

	const right = children.length ? cardX + rightW : currentX + NODE_W;
	return {
		nodes,
		links,
		trunk,
		childCard,
		width: right + GUTTER_X,
		height: Math.max(chainH, rightH) + GUTTER_Y * 2,
	};
}

// ---- 视图 -----------------------------------------------------------------

// 视图状态。dx/dy 是相对「基准取景」的偏移，不是绝对平移量 —— 这样容器尺寸
// 变化（滚动条出现、窗口缩放）时不需要重算，内容也不会跳。
type View = { zoom: number; dx: number; dy: number };

const clampZoom = (z: number) =>
	Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 1000) / 1000));

function NodeChip({
	id,
	label,
	current,
	navigable = true,
	className,
	style,
}: {
	id: string;
	label: string;
	current?: boolean;
	navigable?: boolean;
	className?: string;
	style?: CSSProperties;
}) {
	const base = cn(
		// 圆角矩形：节点是链上的一个「站点」，框宽固定、圆角统一（132×30、8px 圆角），
		// 长短不一的标签名一律居中截断，边缘因此总是齐的。
		"flex items-center justify-center rounded-lg border px-2.5 text-xs leading-none transition-all duration-150",
		// 普通节点不加投影。g835 这类标签有 80 个节点，每个都带一层 box-shadow 时
		// 阴影会沿子标签列叠成一条黑带（用户反馈的「阴影叠起来」）。边框已经足够
		// 区分节点，只给当前焦点节点保留投影。
		current
			? "border-primary/40 bg-primary font-medium text-primary-foreground shadow-md ring-[3px] ring-primary/20"
			: navigable
				? "border-border/80 bg-card text-foreground hover:-translate-y-px hover:border-primary/50 hover:bg-muted hover:shadow-sm"
				: // 未本地化的祖先不可点击：不给 hover 反馈，虚线边框示意「到此为止」
					"border-border/70 border-dashed bg-muted/30 text-muted-foreground",
		className,
	);
	if (current) {
		return (
			<TagTooltip>
				<TooltipTrigger
					render={
						<div data-node className={base} style={style} aria-current="page" />
					}
				>
					<span className="truncate">{label}</span>
				</TooltipTrigger>
				<TagTooltipContent>{label}</TagTooltipContent>
			</TagTooltip>
		);
	}
	if (!navigable) {
		return (
			<TagTooltip>
				<TooltipTrigger
					render={<div data-node className={base} style={style} />}
				>
					<span className="truncate">{label}</span>
				</TooltipTrigger>
				<TagTooltipContent>{`${label}（暂无中文名，无法进入）`}</TagTooltipContent>
			</TagTooltip>
		);
	}
	return (
		<TagTooltip>
			<TooltipTrigger
				render={
					<Link
						to="/tags/$tagId"
						params={{ tagId: id }}
						// 点击时回写展示名，标签详情 pending 态复用
						onClick={() => tagHeroActions.fromTag({ id, name: label })}
						data-node
						className={base}
						style={style}
					/>
				}
			>
				<span className="truncate">{label}</span>
			</TooltipTrigger>
			<TagTooltipContent>{label}</TagTooltipContent>
		</TagTooltip>
	);
}

// 标签层级关系图。
//
// 面包屑只保留「首页 › 标签 › 当前标签」；关系细节收进这里。默认收起，展开后是
// 一块画布，从左到右三段：祖先链 → 当前标签 → 子标签卡片。
//
// 三个刻意的取舍：
//
// 1. 子标签走网格，不走放射。放射布局把几十个子标签摊成六圈同心弧，圈越大同
//    一段弧长能装的框越少，结果就是外圈挤成一团、框框擦边甚至重叠。网格里每个
//    标签都占自己的格子，行列对齐，谁也不压谁（用户反馈的「糊成一团」）。
// 2. 子标签一律整块收进一张卡片，只被一根线连着 —— 无论 2 个还是 80 个。一个个
//    铺成独立节点的话，为了让它们全进画布得缩到一半、字全糊，而且几十根支线本身
//    就是一片噪点；卡片里的格子和「一根线」的接法都是用户点名要的。
// 3. 卡片列数按可用宽度算，取景再按整图缩放；高度上限 70vh。列数与 fitZoom 是
//    配套的，所以框内不会出现被裁掉的格子。
//
// 交互：画布默认不接管输入，点击一次激活；激活后空白处拖拽平移、滚轮以光标为
// 锚点缩放、双击空白处复位，点击画布外立即把滚动权交还页面。已本地化的节点可
// 点击跳转。
//
// 展开/收起不在这里管：标签页（子标签 / 标签层级关系）已经决定了画布显不显示，
// 组件里再挂一个折叠按钮就是同一件事的第二道开关。统计数字（几条路径、几个上级、
// 几个子标签）原先印在那个按钮上，现在挪到画布左上角悬浮。
export function TagHierarchy({ tag }: { tag?: TagHierarchyTag | null }) {
	const [view, setView] = useState<View>({ zoom: 1, dx: 0, dy: 0 });
	const [metrics, setMetrics] = useState({ availW: 0 });
	const [panning, setPanning] = useState(false);
	// 交互锁：滚轮要留给页面滚动，所以画布默认「不接管输入」，点击一次才激活。
	// 激活期间吞掉滚轮（缩放）与拖拽（平移）；点击外部立即交还给页面。
	const [active, setActive] = useState(false);
	// 粗指针（触屏）：没有滚轮，手势是单指拖拽 + 双指捏合，提示文案与 touch-action
	// 都要跟着换一套。
	const [coarse, setCoarse] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{ x: number; y: number } | null>(null);
	// 触屏手势：同时按下的指针（双指 = 捏合缩放），以及捏合的基准
	const pointersRef = useRef(new Map<number, { x: number; y: number }>());
	const pinchRef = useRef<{
		dist: number;
		mid: { x: number; y: number };
		view: View;
	} | null>(null);
	// 本次按下累计移动的像素：触屏上拖完抬手浏览器还会补一次 click，位移够大就
	// 该吞掉它，否则「滑动看图」的收尾会被当成点击、直接跳走。
	const movedRef = useRef(0);
	// 用户一旦手动平移/缩放，就不再自动取景（否则窗口尺寸变化会把视角跳回去）
	const touchedRef = useRef(false);
	// 记住当前画的是哪个标签。`useState` 不会在导航后重挂载这个组件（路由只是换了
	// loader 数据），所以「切换标签 = 重置取景」得靠 id 变化来触发；touched 也一起
	// 清掉，否则上一个标签里拖过的偏移会顺着 touchedRef 继承到下一个标签。
	const [shownTagId, setShownTagId] = useState<string | null>(null);
	useEffect(() => {
		if (!tag?.id || tag.id === shownTagId) return;
		pointersRef.current.clear();
		pinchRef.current = null;
		dragRef.current = null;
		movedRef.current = 0;
		setShownTagId(tag.id);
		touchedRef.current = false;
		setView({ zoom: 1, dx: 0, dy: 0 });
		setPanning(false);
		setActive(false);
	}, [tag?.id, shownTagId]);

	useEffect(() => {
		const mq = window.matchMedia("(pointer: coarse)");
		const read = () => setCoarse(mq.matches);
		read();
		mq.addEventListener("change", read);
		return () => mq.removeEventListener("change", read);
	}, []);

	// 视口高度：画布高度上限 70vh 的 JS 侧等价物。取 window.innerHeight 而不是量
	// 画布自身，因此不会与画布高度互相影响（那正是 5px 塌陷的成因）。
	const [viewportH, setViewportH] = useState(0);
	useEffect(() => {
		const read = () => setViewportH(window.innerHeight);
		read();
		window.addEventListener("resize", read);
		return () => window.removeEventListener("resize", read);
	}, []);

	const maxCanvasH = Math.round(viewportH * MAX_CANVAS_H_VH);

	const paths = useMemo(() => {
		const raw = tag?.ancestorPaths?.length
			? tag.ancestorPaths
			: tag?.ancestors?.length
				? [tag.ancestors]
				: [];
		return raw.filter((path) => path.length > 0);
	}, [tag]);

	const children = useMemo(
		() => (tag?.children ?? []).filter((c) => c.id && c.id !== tag?.id),
		[tag],
	);

	const graph = useMemo(
		() =>
			tag?.id
				? buildGraph(tag, paths, children, metrics.availW || FALLBACK_W)
				: null,
		// availW 决定「能铺几列而不至于糊掉」，所以它是列数的输入。但列数只在
		// 跨过整档时才会变（fits 是 floor 出来的台阶），resize 不会看着标签
		// 一点点跳来跳去。
		[tag, paths, children, metrics.availW],
	);

	// 量外层容器的可用宽度。列数要靠它算，所以这是整个版面的一块输入，不只是取景用。
	// 用 layout effect：首帧就拿到尺寸，网格不会先按兜底宽度摆一次再跳回来。
	useLayoutEffect(() => {
		const wrap = wrapRef.current;
		if (!wrap) return;
		const measure = () => {
			const availW = wrap.clientWidth;
			setMetrics((m) => (m.availW === availW ? m : { availW }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(wrap);
		return () => observer.disconnect();
	}, []);

	/**
	 * 取景缩放：让整张网格完整落进画布框。
	 *
	 * 网格版面不再需要「焦点居中 + 取两侧较大值」那套 —— 祖先链在左、子标签在右，
	 * 左右本身就是不对称的两块，居中哪边都会浪费一截。所以直接把整图按框的宽高
	 * 取小的那一个缩放因子，剩余的留白平均分。
	 *
	 * 列数已经保证缩放不会低于 MIN_READABLE_ZOOM（见 buildGraph），所以这里
	 * 不再设下限；真到了 430 个子标签那种极端情况，宁可让 70vh 的框把最下面
	 * 一两行裁掉，也不要把 430 个标签全缩成看不清的一团 —— 用户还能滚轮+拖拽。
	 */
	const fitZoom = useMemo(() => {
		if (!graph || metrics.availW <= 0) return 1;
		return clampZoom(
			Math.min(
				1,
				metrics.availW / graph.width,
				(maxCanvasH || Number.POSITIVE_INFINITY) / graph.height,
			),
		);
	}, [graph, metrics.availW, maxCanvasH]);

	/** 基准缩放：在整图可见的前提下尽量大 */
	// 窄屏（竖版）再兜一个可读下限：内容高过 70vh 时宁可裁一点、让用户拖，
	// 也别把整块缩成 40% 那种看不清、点不中的样子。
	const narrow = metrics.availW > 0 && metrics.availW < MOBILE_BREAKPOINT;
	const baseZoom = Math.min(
		1,
		Math.max(fitZoom, narrow ? MIN_READABLE_ZOOM : ZOOM_MIN),
	);

	/**
	 * 画布尺寸 = 整图 × 基准缩放，然后按 70vh 截断。
	 *
	 * 注意：高度上限不能把「量到的框高」再喂回框高。挂载当帧量到一次瞬时的小高度
	 * （样式高度此刻还没应用），就会通过 min() 把画布永久压扁。所以用 viewport 的
	 * 70vh（一个与内容无关的常量）来表达。
	 *
	 * fitZoom 已经是「两轴都放得下」的系数，所以这里乘出来的框宽一定 ≤ availW，
	 * 框高一定 ≤ maxCanvasH —— 内容永远不会被裁掉。
	 */
	const naturalW = graph ? Math.round(graph.width * baseZoom) : 0;
	const naturalH = graph
		? Math.min(
				maxCanvasH || Number.POSITIVE_INFINITY,
				Math.round(graph.height * baseZoom),
			)
		: 0;
	// 竖版整图通常比容器窄：画布铺满容器宽度，底部那条浮层（提示 + 工具条）才放
	// 得下。内容依旧居中 —— tx/ty 本来就是按「整图居中于画布」算的。
	const frameW = narrow ? metrics.availW : naturalW;
	const frameH = naturalH;

	/**
	 * 取景：整图在框里居中。dx/dy 是相对居中的偏移，正中央就是 0。
	 *
	 * 竖版内容高过画布时例外：从顶部开始看。竖版是「祖先在上、子标签在下」的
	 * 纵向阅读顺序，居中会把两头各切一半，读起来不知道从哪儿接上。
	 */
	const viewFor = (zoom: number): View => {
		const overflowY = Math.max(0, (graph?.height ?? 0) * zoom - frameH);
		return { zoom, dx: 0, dy: narrow ? overflowY / 2 : 0 };
	};

	// 容器尺寸变化时重新取景；用户动过之后不再打扰。
	// shownTagId 进依赖是为了让「切换标签」也重新取景一次。
	useEffect(() => {
		if (touchedRef.current) return;
		setView(viewFor(baseZoom));
	}, [baseZoom, frameW, frameH, shownTagId]);

	// 未激活时完全不监听：滚轮正常冒泡给页面，用户能滑过这张图。
	// 激活后滚轮一律以光标为锚点缩放（不再有「平移」这一档，滚轮就是缩放）。
	// 要 preventDefault 必须用非 passive 的原生监听 —— React 的 onWheel 挂在
	// root 上是 passive 的，拦不住。
	useEffect(() => {
		const el = frameRef.current;
		if (!el || !graph || !active) return;
		// 整图中心在图坐标系里的位置
		const origin = { x: graph.width / 2, y: graph.height / 2 };
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			touchedRef.current = true;
			const rect = el.getBoundingClientRect();
			const px = e.clientX - rect.left;
			const py = e.clientY - rect.top;
			// deltaMode 1 = 行、2 = 页；换算成像素级增量，触控板与滚轮手感一致
			const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
			// 单次增量必须封顶：翻页式滚轮会送出上千的 deltaY，不封顶的话一滚滚轮
			// 就把缩放从 100% 直接砸到下限，中间没有任何过渡。
			const delta = Math.max(-160, Math.min(160, e.deltaY * unit));
			// 符号取反：向下滚（deltaY > 0）放大，向上滚缩小。
			// 与页面滚动的直觉一致 —— 往下「推进」内容看细节。
			const factor = Math.exp(-delta * 0.002);
			setView((v) => {
				const zoom = clampZoom(v.zoom * factor);
				const ratio = zoom / v.zoom;
				// 光标下的图坐标点在缩放前后必须重合
				const tx = frameW / 2 - origin.x * v.zoom + v.dx;
				const ty = frameH / 2 - origin.y * v.zoom + v.dy;
				const tx2 = px - (px - tx) * ratio;
				const ty2 = py - (py - ty) * ratio;
				return {
					zoom,
					dx: tx2 - frameW / 2 + origin.x * zoom,
					dy: ty2 - frameH / 2 + origin.y * zoom,
				};
			});
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [graph, frameW, frameH, active]);

	// 激活时点外部 → 交还页面
	useEffect(() => {
		if (!active) return;
		const onDocDown = (e: PointerEvent) => {
			if (!frameRef.current?.contains(e.target as Node)) setActive(false);
		};
		document.addEventListener("pointerdown", onDocDown);
		return () => document.removeEventListener("pointerdown", onDocDown);
	}, [active]);

	if (!tag?.id || !graph) return null;
	if (paths.length === 0 && children.length === 0) return null;

	const ancestorCount = new Set(paths.flat().map((n) => n.id)).size;

	const setFraming = (zoom: number) => {
		touchedRef.current = false;
		setView(viewFor(zoom));
	};

	/** 以画布中心为锚点缩放，偏移量同比例缩放即可 */
	const zoomBy = (factor: number) => {
		touchedRef.current = true;
		setView((v) => {
			const zoom = clampZoom(v.zoom * factor);
			const ratio = zoom / v.zoom;
			return { zoom, dx: v.dx * ratio, dy: v.dy * ratio };
		});
	};

	/**
	 * 触屏手势：单指拖拽平移、双指捏合缩放。
	 *
	 * 手机上的老问题是整块画布「点了没反应」：`touch-action` 是默认的 auto，手指
	 * 一拖就被浏览器当成滚页面，随即发出 pointercancel，画布再也收不到 pointermove。
	 * 这里给激活后的画布加 `touch-action: none` 接管手势，并自己实现捏合缩放 ——
	 * 移动端没有滚轮，缩放只能靠双指；工具条上的 ± 是给单指的退路。
	 */
	const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		// 每次按下都清零：上一次拖拽的位移不能把这一次点击吞掉（见 onClickCapture）
		movedRef.current = 0;
		// 第一次点击只用于「激活」，不当作平移起点
		if (!active) {
			setActive(true);
			return;
		}
		// 工具条/提示浮层：一旦在它们上面开始拖拽，setPointerCapture 会把后续
		// click 重定向到画布，按钮就彻底点不动了。
		if ((e.target as HTMLElement).closest("[data-overlay]")) return;
		if (e.pointerType === "touch") {
			// 触屏上从节点上起手也要能拖：拇指按在框上顺手一划就是平移。点击跳转
			// 由 onClickCapture 按「位移超过阈值就吞掉这次 click」兜住。
			pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
			e.currentTarget.setPointerCapture(e.pointerId);
			if (pointersRef.current.size >= 2) {
				const [a, b] = [...pointersRef.current.values()];
				pinchRef.current = {
					dist: Math.hypot(a.x - b.x, a.y - b.y),
					mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
					view,
				};
				dragRef.current = null;
			} else {
				dragRef.current = { x: e.clientX, y: e.clientY };
			}
			touchedRef.current = true;
			setPanning(true);
			return;
		}
		// 鼠标/触控笔：节点上按下不拖拽，把手势留给「点击跳转」
		if ((e.target as HTMLElement).closest("[data-node]")) return;
		e.currentTarget.setPointerCapture(e.pointerId);
		dragRef.current = { x: e.clientX, y: e.clientY };
		touchedRef.current = true;
		setPanning(true);
	};
	const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.pointerType === "touch") {
			if (!pointersRef.current.has(e.pointerId)) return;
			pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
			const pinch = pinchRef.current;
			if (pinch && pointersRef.current.size >= 2) {
				const [a, b] = [...pointersRef.current.values()];
				const dist = Math.hypot(a.x - b.x, a.y - b.y);
				if (pinch.dist > 0 && dist > 0) {
					const zoom = clampZoom(pinch.view.zoom * (dist / pinch.dist));
					const rect = e.currentTarget.getBoundingClientRect();
					const ox = graph.width / 2;
					const oy = graph.height / 2;
					// 捏合前压在两根手指中点下那个图坐标点，捏合后要还压在新的中点下
					const from = {
						x: pinch.mid.x - rect.left,
						y: pinch.mid.y - rect.top,
					};
					const to = {
						x: (a.x + b.x) / 2 - rect.left,
						y: (a.y + b.y) / 2 - rect.top,
					};
					const tx0 = frameW / 2 - ox * pinch.view.zoom + pinch.view.dx;
					const ty0 = frameH / 2 - oy * pinch.view.zoom + pinch.view.dy;
					const gx = (from.x - tx0) / pinch.view.zoom;
					const gy = (from.y - ty0) / pinch.view.zoom;
					const tx = to.x - gx * zoom;
					const ty = to.y - gy * zoom;
					movedRef.current = CLICK_SLOP + 1;
					touchedRef.current = true;
					setPanning(true);
					setView({
						zoom,
						dx: tx - frameW / 2 + ox * zoom,
						dy: ty - frameH / 2 + oy * zoom,
					});
				}
				return;
			}
			const drag = dragRef.current;
			if (!drag) return;
			const tdx = e.clientX - drag.x;
			const tdy = e.clientY - drag.y;
			drag.x = e.clientX;
			drag.y = e.clientY;
			movedRef.current += Math.hypot(tdx, tdy);
			setView((v) => ({ ...v, dx: v.dx + tdx, dy: v.dy + tdy }));
			return;
		}
		const drag = dragRef.current;
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		drag.x = e.clientX;
		drag.y = e.clientY;
		setView((v) => ({ ...v, dx: v.dx + dx, dy: v.dy + dy }));
	};
	const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.pointerType === "touch") pointersRef.current.delete(e.pointerId);
		if (pointersRef.current.size < 2) pinchRef.current = null;
		if (dragRef.current) {
			dragRef.current = null;
			setPanning(false);
		}
		if (pointersRef.current.size === 0) {
			pinchRef.current = null;
			setPanning(false);
		}
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId);
		}
	};

	// 整图在框里居中。origin 是「图坐标系里的整图中心」，缩放/平移都以它为基准。
	const tx = frameW / 2 - (graph.width / 2) * view.zoom + view.dx;
	const ty = frameH / 2 - (graph.height / 2) * view.zoom + view.dy;
	const ready = metrics.availW > 0 && frameH > 0;

	return (
		<section className="w-full">
			<div
				ref={wrapRef}
				className="animate-in fade-in-0 zoom-in-95 duration-200"
			>
				<div
					ref={frameRef}
					role="group"
					aria-label="标签层级关系图"
					tabIndex={0}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={endPan}
					onPointerCancel={endPan}
					// 触屏上拖完抬手，浏览器还会补一次 click：位移够大就吞掉它，
					// 否则「滑动看图」的收尾会被当成点了一次节点、直接跳走。
					onClickCapture={(e) => {
						if (movedRef.current <= CLICK_SLOP) return;
						movedRef.current = 0;
						e.preventDefault();
						e.stopPropagation();
					}}
					onDoubleClick={(e) => {
						if ((e.target as HTMLElement).closest("[data-node]")) return;
						setFraming(baseZoom);
					}}
					className={cn(
						"relative mx-auto overflow-hidden rounded-2xl border select-none outline-none",
						// 量到尺寸之前先不显形，避免首帧按整行宽度闪一下再收窄
						ready ? "border-border/60" : "border-transparent",
						// 激活态：边框加粗 + 焦点环，明确告诉用户「现在这块归你了」
						active
							? "cursor-grab border-2 border-primary shadow-lg ring-[3px] ring-primary/20"
							: "cursor-pointer border",
						panning && "cursor-grabbing",
					)}
					style={{
						width: ready ? frameW : "100%",
						// 宽度同样受容器约束：自适应缩放保证「以焦点为中心」所需的
						// 半宽能放下，但节点列在容器比公式结果更窄时仍会溢出边框。
						maxWidth: "100%",
						height: naturalH,
						maxHeight: "70vh",
						// 激活后由画布接管手势（单指拖拽平移、双指捏合缩放）。不激活时
						// 保持 auto：手指划过去仍然是在滚页面，不会被这块画布吃掉。
						touchAction: active ? "none" : "auto",
						backgroundColor: ready ? CANVAS_BG : "transparent",
						backgroundImage: ready
							? `${SPOTLIGHT}, radial-gradient(circle, ${DOT} 1px, transparent 1px)`
							: "none",
						backgroundSize: `100% 100%, ${GRID * view.zoom}px ${GRID * view.zoom}px`,
						backgroundPosition: `0 0, ${tx}px ${ty}px`,
					}}
				>
					{/* 统计数字悬浮在画布左上角：它描述的是这张图本身，挂在折叠开关上
					    既放错了位置，开关一去掉也没地方放了。pointer-events-none 是因为
					    它不是可点的东西，不该挡住从左上角起手的拖拽平移。 */}
					<div className="pointer-events-none absolute top-2 left-2 z-10 rounded-full border border-border/60 bg-popover/85 px-2.5 py-1 text-[11px] text-muted-foreground tabular-nums shadow-sm backdrop-blur">
						{paths.length} 条路径 · {ancestorCount} 个上级
						{children.length > 0 && ` · ${children.length} 个子标签`}
					</div>
					<div
						className="absolute top-0 left-0 origin-top-left"
						style={{
							width: graph.width,
							height: graph.height,
							opacity: ready ? 1 : 0,
							transform: `translate(${tx}px, ${ty}px) scale(${view.zoom})`,
						}}
					>
						<svg
							className="absolute inset-0 overflow-visible"
							width={graph.width}
							height={graph.height}
							aria-hidden="true"
						>
							{/* 祖先链：逐段水平线，汇入当前标签的那几段加粗 */}
							{graph.links.map((link, i) => (
								<path
									key={`link-${i}`}
									d={link.d}
									fill="none"
									strokeLinecap="round"
									strokeWidth={link.intoCurrent ? 2 : 1.25}
									className={
										link.intoCurrent
											? "stroke-primary/60"
											: "stroke-muted-foreground/30"
									}
								/>
							))}
							{/* 子标签那条唯一的主干：当前标签 → 卡片 */}
							{graph.trunk && (
								<g
									className="stroke-muted-foreground/40"
									fill="none"
									strokeWidth={1.25}
								>
									<path d={graph.trunk} />
								</g>
							)}
						</svg>
						{graph.nodes.map((node) => (
							<NodeChip
								key={node.id}
								id={node.id}
								label={node.label}
								current={node.current}
								navigable={node.navigable}
								className="absolute"
								style={{
									left: node.x,
									top: node.y,
									width: node.w,
									height: NODE_H,
								}}
							/>
						))}
						{/* 「子标签」三个字压在连线的断口上，替代卡片自己的标题条 —— 卡片里
							    再留一条标题就重复了，连线光秃秃的也看不出它通向什么。 */}
						{graph.childCard && (
							<div
								className="pointer-events-none absolute flex items-center justify-center text-[10px] text-muted-foreground leading-none"
								style={{
									left: graph.childCard.label.x,
									top: graph.childCard.label.y,
									width: graph.childCard.label.w,
									height: graph.childCard.label.h,
								}}
							>
								子标签
							</div>
						)}
						{/* 子标签太多时的收纳卡片：整块当做一个节点，只被一根线连着。
							    卡片里的格子是固定尺寸的 CSS grid，所以卡片高度与 buildGraph
							    算出来的一致（行列数就是那里定下来的），不会被裁掉一格。 */}
						{graph.childCard && (
							<div
								data-node
								className="absolute overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm"
								style={{
									left: graph.childCard.x,
									top: graph.childCard.y,
									width: graph.childCard.w,
									height: graph.childCard.h,
								}}
							>
								<div
									className="grid"
									style={{
										padding: CARD_PAD,
										gridTemplateColumns: `repeat(${graph.childCard.cols}, ${graph.childCard.cellW}px)`,
										columnGap: CARD_CELL_GAP_X,
										rowGap: CARD_CELL_GAP_Y,
									}}
								>
									{children.map((child) => (
										<Tooltip key={child.id}>
											<TooltipTrigger
												render={
													<Link
														to="/tags/$tagId"
														params={{ tagId: child.id }}
														// 点击时回写展示名，标签详情 pending 态复用
														onClick={() =>
															tagHeroActions.fromTag({
																id: child.id,
																zht_name: child.zht_name,
																name: child.name,
															})
														}
														className="flex items-center justify-center rounded-md border border-border/70 bg-muted/40 px-1.5 text-[11px] text-foreground leading-none transition-colors hover:border-primary/50 hover:bg-muted"
														style={{ height: CARD_CELL_H }}
													>
														<span className="truncate">{labelOf(child)}</span>
													</Link>
												}
											/>
											<TooltipContent>{labelOf(child)}</TooltipContent>
										</Tooltip>
									))}
								</div>
							</div>
						)}
					</div>

					{/* 画布内浮层：左下角操作提示 + 右下角工具条。
						    刻意不用 `pointer-events-none` 外层 + `pointer-events-auto` 内层：
						    pointer-events 是继承属性，实测这里 auto 没盖住继承来的 none，
						    按钮直接点不动。改成「浮层本身就是可交互的」，靠 onPointerDown 里
						    的 [data-overlay] 守卫避免在工具条上误触发平移。 */}
					<div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
						<div
							data-overlay
							className="flex items-center gap-1 rounded-full border border-border/60 bg-popover/85 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur select-none"
						>
							{active ? (
								<Move className="size-3" />
							) : (
								<Hand className="size-3" />
							)}
							{active
								? coarse
									? "单指拖拽 · 双指缩放"
									: "拖拽平移 · 滚轮缩放"
								: "点击以交互"}
						</div>
						<div
							data-overlay
							className="ml-auto flex items-center gap-0.5 rounded-full border border-border/60 bg-popover/85 p-0.5 shadow-sm backdrop-blur"
						>
							{/* 触屏上一屏几乎全是画布，「点空白处退出」没那么顺手：给一个
							    明确的出口，免得手指被困在画布里、页面滚不动。 */}
							{coarse && active && (
								<>
									<Tooltip>
										<TooltipTrigger
											render={
												<Button
													size="icon-xs"
													variant="ghost"
													aria-label="退出手势（恢复页面滚动）"
													className="size-8 rounded-full sm:size-6"
													onClick={() => setActive(false)}
												>
													<X />
												</Button>
											}
										/>
										<TooltipContent>退出手势（恢复页面滚动）</TooltipContent>
									</Tooltip>
									<span className="mx-0.5 h-4 w-px bg-border" />
								</>
							)}
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											size="icon-xs"
											variant="ghost"
											aria-label="缩小"
											className="size-8 rounded-full sm:size-6"
											onClick={() => zoomBy(1 / ZOOM_STEP)}
											disabled={view.zoom <= ZOOM_MIN}
										>
											<Minus />
										</Button>
									}
								/>
								<TooltipContent>缩小</TooltipContent>
							</Tooltip>
							<span className="w-9 text-center text-[11px] text-muted-foreground tabular-nums">
								{Math.round(view.zoom * 100)}%
							</span>
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											size="icon-xs"
											variant="ghost"
											aria-label="放大"
											className="size-8 rounded-full sm:size-6"
											onClick={() => zoomBy(ZOOM_STEP)}
											disabled={view.zoom >= ZOOM_MAX}
										>
											<Plus />
										</Button>
									}
								/>
								<TooltipContent>放大</TooltipContent>
							</Tooltip>
							<span className="mx-0.5 h-4 w-px bg-border" />
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											size="icon-xs"
											variant="ghost"
											aria-label="适应画布（全览）"
											className="size-8 rounded-full sm:size-6"
											onClick={() => setFraming(fitZoom)}
										>
											<Maximize2 />
										</Button>
									}
								/>
								<TooltipContent>适应画布（全览）</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											size="icon-xs"
											variant="ghost"
											aria-label="回到 1:1"
											className="size-8 rounded-full sm:size-6"
											onClick={() => setFraming(1)}
										>
											<LocateFixed />
										</Button>
									}
								/>
								<TooltipContent>回到 1:1</TooltipContent>
							</Tooltip>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
