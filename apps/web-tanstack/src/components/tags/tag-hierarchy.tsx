import { Link } from "@tanstack/react-router";
import { Button } from "@web/components/ui/button";
import { cn } from "@web/lib/utils";
import {
	ChevronDown,
	Hand,
	LocateFixed,
	Maximize2,
	Minus,
	Move,
	Network,
	Plus,
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

const COL_GAP = 12; // 子标签网格相邻两列之间的水平间隙
const ROW_GAP = 12; // 子标签网格相邻两行之间的垂直间隙
const ANC_GAP = 26; // 祖先链末节点 → 当前标签左缘
const ANC_LINK = 24; // 祖先链内相邻两节点之间的连线长度
const FAN_GAP = 26; // 当前标签右缘 → 子标签总线
const STUB = 18; // 总线 → 子标签网格左缘
const PANEL_TITLE_H = 20; // 底板顶部留给标题的那一条
const MAX_COLS = 12; // 列数上限：再多就成了一条几万像素宽的横幅
const GRID_TARGET_AR = 2.2; // 网格的目标宽高比，太扁像横幅、太长像目录
const MIN_READABLE_ZOOM = 0.72; // 全览缩放的下限：低于此值字就糊了，宁可裁一点

// ---- 子标签卡片（子标签过多时的收纳盒）------------------------------------
//
// 78 个子标签一个个铺成独立节点时，为了让它们全塞进画布得缩到 50% 出头，字全糊了。
// 换成「一张卡片装下全部、一根线接过来」：卡片里是等宽对齐的小药丸，格子的行列数
// 是算出来的（不是量出来的），所以卡片尺寸确定、缩放确定，能一直保持在 100% 附近。
const CHILD_CHIP_MAX = 18; // 超过这个数就收进卡片，不再一个个铺节点
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
const CARD_TARGET_AR = 1.5; // 卡片自己的目标宽高比：略宽于方

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 1.2;

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

/** 子标签底板的包围盒（含总线留白与标题那一条），用来画虚线框与标题 */
type Panel = { x: number; y: number; w: number; h: number; count: number };

/** 子标签过多时的收纳卡片：一张卡装下全部，再用一根线接过来 */
type ChildCard = Panel & {
	cols: number;
	/** 「子标签」三个字压在连线上，这是它占的那块位置 */
	label: { x: number; y: number; w: number; h: number };
};

type Graph = {
	nodes: GraphNode[];
	/** 祖先链（含汇入当前标签的那几段），逐段给主链上的节点用 */
	links: GraphLink[];
	/** 当前标签右缘 → 子标签总线（或卡片）的横向主干 */
	trunk: string;
	/** 子标签总线的纵向段；只有卡片模式或单行子标签时为空串 */
	spine: string;
	/** 每条支线：总线 → 该子标签的左缘；卡片模式为空 */
	stubs: string[];
	/** 子标签底板与标题（独立节点模式）；没有子标签或走卡片时为 null */
	childPanel: Panel | null;
	/** 子标签收纳卡片；子标签不够多时为 null（那就还是一个节点一个格子） */
	childCard: ChildCard | null;
	width: number;
	height: number;
};

/** 极短的水平连线（节点框之间那几十像素） */
function hline(x1: number, x2: number, y: number): string {
	return `M ${x1.toFixed(1)} ${y.toFixed(1)} H ${x2.toFixed(1)}`;
}

/** 一条竖向总线：子标签铺成多行时，从第一行的中线垂到最后一行的中线 */
function vline(x: number, y1: number, y2: number): string {
	return `M ${x.toFixed(1)} ${y1.toFixed(1)} V ${y2.toFixed(1)}`;
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
 * （纯宽高比）会把 12 个格子摊成一行 2000px 的横幅。所以先在「缩到可读缩放还
 * 放得下」的列数里筛，再按宽高比取最优 —— 取景因此总是落在可读区间。
 */
function chooseCols(count: number, b: Box): number {
	if (count <= 1) return 1;
	const fits = Math.max(
		1,
		Math.min(b.maxCols, Math.floor((b.maxW + b.gapX) / (b.cellW + b.gapX))),
	);
	const shortest = boxH(b, count, fits);
	let cols = fits;
	let best = Number.POSITIVE_INFINITY;
	for (let n = 1; n <= fits; n++) {
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

// 把祖先路径 + 子标签摊成一张三段式版面：祖先链 | 当前标签 | 子标签。
//
// 祖先链按「到当前标签的跳数」分列，同跳同列。用跳数而不是最长路径层级：祖先
// 本来就少（g835 只有 2 个），同跳同列就是最自然的网格语义，也不会把某个节点
// 为了「父必须比子更左」而推到几跳之外去。
//
// 右侧那一块按数量二选一：
//
// - 子标签不多（≤ CHILD_CHIP_MAX）：一个个铺成独立节点，总线 + 支线接过去，
//   一眼看得出「这些都是它的下级」。
// - 子标签太多：整块收进一张卡片，只留**一根**线。78 个独立节点为了让它们全塞进
//   画布得一路缩到 50% 出头，字全糊了，而且 78 根支线本身就是一片噪点；收进卡片
//   后格子压到 106×24，78 个也只是一张 576×490 的卡，整图能稳稳保持 100%。
//
// 为什么不是放射图：放射布局把 78 个子标签摊成六圈同心弧，弧上每个框都占一段
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
	const ancPerCol = Math.max(
		1,
		...[...byColumn.values()].map((ids) => ids.length),
	);
	const chainH = ancPerCol * NODE_H + (ancPerCol - 1) * ROW_GAP;

	// ---- 右侧那一块：子标签要么一个个铺，要么收进一张卡片 ----
	//
	// 祖先链最多也就三四列（十几跳），不能让它跟子标签抢宽度 —— 抢了就是
	// 「右边几个孤零零的框、左边一大片空白」。所以宽度预算先扣掉祖先段，剩下的
	// 给右侧：够铺得下就一个个铺（看得出层级），铺不下就整块收进卡片。
	const ancW = maxHop > 0 ? maxHop * NODE_W + maxHop * ANC_LINK : 0;
	// 缩到 MIN_READABLE_ZOOM 后仍要放得下容器 ⇒ 整图宽 ≤ availW / MIN_READABLE_ZOOM
	const budget = Math.max(
		NODE_W * 2,
		availW / MIN_READABLE_ZOOM - (GUTTER_X * 2 + ANC_GAP + ancW),
	);
	const useCard = children.length > CHILD_CHIP_MAX;
	const gridBox: Box = {
		cellW: NODE_W,
		cellH: NODE_H,
		gapX: COL_GAP,
		gapY: ROW_GAP,
		maxCols: MAX_COLS,
		targetAr: GRID_TARGET_AR,
		maxW: Math.max(NODE_W * 2, budget - FAN_GAP - STUB),
	};
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
		? chooseCols(children.length, useCard ? cardBox : gridBox)
		: 0;
	// 右侧块的尺寸：卡片模式把内边距与边框都算进去（「子标签」三个字压在连线上，
	// 不占卡片的高度）
	const rightW = !children.length
		? 0
		: useCard
			? boxW(cardBox, cols) + CARD_PAD * 2 + CARD_BORDER * 2
			: boxW(gridBox, cols);
	const rightH = !children.length
		? 0
		: useCard
			? boxH(cardBox, children.length, cols) + CARD_PAD * 2 + CARD_BORDER * 2
			: boxH(gridBox, children.length, cols);

	// ---- 坐标：整条版面垂直居中在同一条中线上 ----
	//
	// 所有节点共用一个 y 中线（当前标签），祖先链与子标签网格各自在自己的方向上
	// 从这条中线向上下展开。于是每条连线都是水平线或一条短竖线，没有斜的，
	// 也没有任何两条线交叉。
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

	const gridX = currentX + NODE_W + FAN_GAP;
	const cardX = currentX + NODE_W + CARD_GAP;
	if (!useCard) {
		children.forEach((child, i) => {
			placed.push({
				id: child.id,
				x: gridX + (i % cols) * (NODE_W + COL_GAP),
				y: midY - rightH / 2 + Math.floor(i / cols) * (NODE_H + ROW_GAP),
				current: false,
			});
		});
	}

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

	// 子标签，两种接法：
	//
	// 少量（≤ CHILD_CHIP_MAX）：当前标签右缘 → 总线 → 每个子标签一根支线。总线
	// 固定在网格左侧 STUB 处，支线长度因此与标签名无关。
	// 大量：一整个卡片当做一个节点，只用**一根**线接过去 —— 78 根支线就算排整齐
	// 也是一片噪点，而且为了排下它们整图得缩到一半。
	let trunk = "";
	let spine = "";
	const stubs: string[] = [];
	let childPanel: Panel | null = null;
	let childCard: ChildCard | null = null;
	if (current && useCard && children.length > 0) {
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
			label: {
				x: gapL,
				y: midY - CARD_LABEL_H / 2,
				w: CARD_LABEL_W,
				h: CARD_LABEL_H,
			},
		};
	} else if (current && children.length > 0) {
		const busX = gridX - STUB;
		const busTop = midY - rightH / 2 + NODE_H / 2;
		const busBottom = midY + rightH / 2 - NODE_H / 2;
		trunk = hline(current.x + NODE_W, busX, midY);
		spine = vline(busX, busTop, busBottom);
		for (const child of children) {
			const node = nodeById.get(child.id);
			if (!node) continue;
			stubs.push(hline(busX, node.x, node.y + NODE_H / 2));
		}
		childPanel = {
			x: gridX - STUB - 6,
			y: midY - rightH / 2 - PANEL_TITLE_H,
			w: rightW + STUB + 6,
			h: rightH + PANEL_TITLE_H,
			count: children.length,
		};
	}

	const right = children.length
		? (useCard ? cardX : gridX) + rightW
		: currentX + NODE_W;
	return {
		nodes,
		links,
		trunk,
		spine,
		stubs,
		childPanel,
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
		"flex items-center justify-center rounded-lg border px-2.5 text-xs leading-none transition-all duration-150",
		// 普通节点不加投影。g835 这类标签有 80 个节点，每个都带一层 box-shadow 时
		// 阴影会沿子标签列叠成一条黑带（用户反馈的「阴影叠起来」）。边框已经足够
		// 区分节点，只给当前焦点节点保留投影。
		current
			? "border-primary/40 bg-primary font-medium text-primary-foreground shadow-md ring-[3px] ring-primary/20"
			: navigable
				? "border-border/80 bg-card text-foreground hover:-translate-y-px hover:border-primary/50 hover:bg-muted hover:shadow-sm"
				// 未本地化的祖先不可点击：不给 hover 反馈，虚线边框示意「到此为止」
				: "border-border/70 border-dashed bg-muted/30 text-muted-foreground",
		className,
	);
	if (current) {
		return (
			<div
				data-node
				className={base}
				style={style}
				title={label}
				aria-current="page"
			>
				<span className="truncate">{label}</span>
			</div>
		);
	}
	if (!navigable) {
		return (
			<div
				data-node
				className={base}
				style={style}
				title={`${label}（暂无中文名，无法进入）`}
			>
				<span className="truncate">{label}</span>
			</div>
		);
	}
	return (
		<Link
			to="/tags/$tagId"
			params={{ tagId: id }}
			data-node
			className={base}
			style={style}
			title={label}
		>
			<span className="truncate">{label}</span>
		</Link>
	);
}

// 标签层级关系图。
//
// 面包屑只保留「首页 › 标签 › 当前标签」；关系细节收进这里。默认收起，展开后是
// 一块画布，从左到右三段：祖先链 → 当前标签 → 子标签。
//
// 三个刻意的取舍：
//
// 1. 子标签走网格，不走放射。放射布局把 78 个子标签摊成六圈同心弧，圈越大同
//    一段弧长能装的框越少，结果就是外圈挤成一团、框框擦边甚至重叠。网格里每个
//    标签都占自己的格子，行列对齐，谁也不压谁（用户反馈的「糊成一团」）。
// 2. 子标签太多（当前是 18 个以上）就整块收进一张卡片，只被一根线连着。这时
//    再一个个铺节点，为了让它们全进画布得缩到一半、字全糊；卡片里的格子和「一根
//    线」的接法都是用户点名要的。
// 3. 格子数（网格列数 / 卡片列数）按可用宽度算，取景再按整图缩放；高度上限
//    70vh。列数与 fitZoom 是配套的，所以框内不会出现被裁掉的节点。
//
// 交互：画布默认不接管输入，点击一次激活；激活后空白处拖拽平移、滚轮以光标为
// 锚点缩放、双击空白处复位，点击画布外立即把滚动权交还页面。已本地化的节点可
// 点击跳转。
export function TagHierarchy({ tag }: { tag?: TagHierarchyTag | null }) {
	const [open, setOpen] = useState(false);
	const [view, setView] = useState<View>({ zoom: 1, dx: 0, dy: 0 });
	const [metrics, setMetrics] = useState({ availW: 0 });
	const [panning, setPanning] = useState(false);
	// 交互锁：滚轮要留给页面滚动，所以画布默认「不接管输入」，点击一次才激活。
	// 激活期间吞掉滚轮（缩放）与拖拽（平移）；点击外部立即交还给页面。
	const [active, setActive] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<{ x: number; y: number } | null>(null);
	// 用户一旦手动平移/缩放，就不再自动取景（否则窗口尺寸变化会把视角跳回去）
	const touchedRef = useRef(false);
	// 记住当前画的是哪个标签。`useState` 不会在导航后重挂载这个组件（路由只是换了
	// loader 数据），所以「切换标签 = 重置取景」得靠 id 变化来触发；touched 也一起
	// 清掉，否则上一个标签里拖过的偏移会顺着 touchedRef 继承到下一个标签。
	const [shownTagId, setShownTagId] = useState<string | null>(null);
	useEffect(() => {
		if (!tag?.id || tag.id === shownTagId) return;
		setShownTagId(tag.id);
		touchedRef.current = false;
		setView({ zoom: 1, dx: 0, dy: 0 });
		setPanning(false);
		setActive(false);
	}, [tag?.id, shownTagId]);

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
		if (!open || !wrap) return;
		const measure = () => {
			const availW = wrap.clientWidth;
			setMetrics((m) => (m.availW === availW ? m : { availW }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(wrap);
		return () => observer.disconnect();
	}, [open]);

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
	const baseZoom = Math.max(ZOOM_MIN, fitZoom);

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
	const frameW = naturalW;
	const frameH = naturalH;

	/** 取景：整图在框里居中。dx/dy 是相对居中的偏移，正中央就是 0 */
	const viewFor = (zoom: number): View => {
		return { zoom, dx: 0, dy: 0 };
	};

	// 展开 / 容器尺寸变化时重新取景；用户动过之后不再打扰。
	// shownTagId 进依赖是为了让「切换标签」也重新取景一次。
	useEffect(() => {
		if (!open || touchedRef.current) return;
		setView(viewFor(baseZoom));
	}, [open, baseZoom, frameW, frameH, shownTagId]);

	// 未激活时完全不监听：滚轮正常冒泡给页面，用户能滑过这张图。
	// 激活后滚轮一律以光标为锚点缩放（不再有「平移」这一档，滚轮就是缩放）。
	// 要 preventDefault 必须用非 passive 的原生监听 —— React 的 onWheel 挂在
	// root 上是 passive 的，拦不住。
	useEffect(() => {
		const el = frameRef.current;
		if (!el || !open || !graph || !active) return;
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
	}, [open, graph, frameW, frameH, active]);

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

	const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		// 第一次点击只用于「激活」，不当作平移起点
		if (!active) {
			setActive(true);
			return;
		}
		// 节点上按下不拖拽，避免和「点击跳转」抢手势；工具条/提示浮层同理 ——
		// 一旦在它们上面开始拖拽，setPointerCapture 会把后续 click 重定向到画布，
		// 按钮就彻底点不动了。
		if ((e.target as HTMLElement).closest("[data-node],[data-overlay]")) return;
		e.currentTarget.setPointerCapture(e.pointerId);
		dragRef.current = { x: e.clientX, y: e.clientY };
		touchedRef.current = true;
		setPanning(true);
	};
	const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag) return;
		const dx = e.clientX - drag.x;
		const dy = e.clientY - drag.y;
		drag.x = e.clientX;
		drag.y = e.clientY;
		setView((v) => ({ ...v, dx: v.dx + dx, dy: v.dy + dy }));
	};
	const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (!dragRef.current) return;
		dragRef.current = null;
		setPanning(false);
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
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				className={cn(
					"group inline-flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-2.5 pl-3 text-xs transition-colors hover:border-primary/40 hover:bg-muted",
					open && "border-primary/40 bg-muted",
				)}
			>
				<Network className="size-3.5 text-muted-foreground group-hover:text-primary" />
				<span className="font-medium text-foreground">标签层级关系</span>
				<span className="text-muted-foreground tabular-nums">
					{paths.length} 条路径 · {ancestorCount} 个上级
					{children.length > 0 && ` · ${children.length} 个子标签`}
				</span>
				<ChevronDown
					className={cn(
						"size-3.5 text-muted-foreground transition-transform duration-200",
						open && "rotate-180",
					)}
				/>
			</button>

			{open && (
				<div
					ref={wrapRef}
					className="mt-2 animate-in fade-in-0 zoom-in-95 duration-200"
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
							backgroundColor: ready ? CANVAS_BG : "transparent",
							backgroundImage: ready
								? `${SPOTLIGHT}, radial-gradient(circle, ${DOT} 1px, transparent 1px)`
								: "none",
							backgroundSize: `100% 100%, ${GRID * view.zoom}px ${GRID * view.zoom}px`,
							backgroundPosition: `0 0, ${tx}px ${ty}px`,
						}}
					>
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
								{/* 子标签组的底板：把「一对多的下级」和祖先链在视觉上切开 */}
								{graph.childPanel && (
									<rect
										x={graph.childPanel.x}
										y={graph.childPanel.y}
										width={graph.childPanel.w}
										height={graph.childPanel.h}
										rx={12}
										className="fill-muted/40 stroke-border/70"
										strokeWidth={1}
										strokeDasharray="4 4"
									/>
								)}
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
								{/* 子标签汇流线：主干 + 竖向总线 + 每个子标签一段支线 */}
								{graph.trunk && (
									<g
										className="stroke-muted-foreground/40"
										fill="none"
										strokeWidth={1.25}
									>
										<path d={graph.trunk} />
										{graph.spine && <path d={graph.spine} />}
										{graph.stubs.map((d, i) => (
											<path key={`stub-${i}`} d={d} />
										))}
									</g>
								)}
							</svg>
							{graph.childPanel && (
								<div
									className="pointer-events-none absolute text-[10px] font-medium text-muted-foreground"
									style={{
										left: graph.childPanel.x + 10,
										top: graph.childPanel.y + 3,
									}}
								>
									子标签 {graph.childPanel.count}
								</div>
							)}
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
							    算出来的一致（行列数就是那里定下来的），不会被裁掉一格。
							    虚线 + 透明底：它是个「把这些标签归到一组」的框，不是又一个节点 ——
							    实心卡片会和真正的标签节点抢视线。留 `data-node` 在药丸上而不是
							    框上，于是框内的空白处照样能拖拽平移。 */}
							{graph.childCard && (
								<div
									className="absolute overflow-hidden rounded-xl border border-border/70 border-dashed"
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
											gridTemplateColumns: `repeat(${graph.childCard.cols}, ${CARD_CELL_W}px)`,
											columnGap: CARD_CELL_GAP_X,
											rowGap: CARD_CELL_GAP_Y,
										}}
									>
										{children.map((child) => (
											<Link
												key={child.id}
												to="/tags/$tagId"
												params={{ tagId: child.id }}
												data-node
												title={labelOf(child)}
												className="flex items-center justify-center rounded-md border border-border/70 bg-muted/40 px-1.5 text-[11px] text-foreground leading-none transition-colors hover:border-primary/50 hover:bg-muted"
												style={{ height: CARD_CELL_H }}
											>
												<span className="truncate">{labelOf(child)}</span>
											</Link>
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
								{active ? "拖拽平移 · 滚轮缩放" : "点击以交互"}
							</div>
							<div
								data-overlay
								className="ml-auto flex items-center gap-0.5 rounded-full border border-border/60 bg-popover/85 p-0.5 shadow-sm backdrop-blur"
							>
								<Button
									size="icon-xs"
									variant="ghost"
									className="rounded-full"
									onClick={() => zoomBy(1 / ZOOM_STEP)}
									disabled={view.zoom <= ZOOM_MIN}
									title="缩小"
								>
									<Minus />
								</Button>
								<span className="w-9 text-center text-[11px] text-muted-foreground tabular-nums">
									{Math.round(view.zoom * 100)}%
								</span>
								<Button
									size="icon-xs"
									variant="ghost"
									className="rounded-full"
									onClick={() => zoomBy(ZOOM_STEP)}
									disabled={view.zoom >= ZOOM_MAX}
									title="放大"
								>
									<Plus />
								</Button>
								<span className="mx-0.5 h-4 w-px bg-border" />
								<Button
									size="icon-xs"
									variant="ghost"
									className="rounded-full"
									onClick={() => setFraming(fitZoom)}
									title="适应画布（全览）"
								>
									<Maximize2 />
								</Button>
								<Button
									size="icon-xs"
									variant="ghost"
									className="rounded-full"
									onClick={() => setFraming(1)}
									title="回到 1:1"
								>
									<LocateFixed />
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
