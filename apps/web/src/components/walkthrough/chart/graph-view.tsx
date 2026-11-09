import { Drawer, DrawerContent, DrawerTitle } from "@web/components/ui/drawer";
import { useIsNarrow } from "@web/hooks/use-mobile";
import { cn } from "@web/lib/utils";
import {
	CornerDownRight,
	Expand,
	Flag,
	List,
	Maximize2,
	Minus,
	Play,
	Plus,
	RotateCcw,
	Save,
	Shrink,
} from "lucide-react";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	type ChartEdgeChunk,
	type ChartNodeId,
	chartEdgeChunks,
	chartNodeId,
	edgeOptionLabel,
	nodeLabel,
} from "./chart-utils";
import { GraphOptionsPanel } from "./graph-options-panel";
import type {
	ChartEnding,
	ChartEndingType,
	ChartLang,
	ChartNode,
	ChartText,
	WalkthroughChart,
} from "./types";

export interface GraphViewProps {
	chart: WalkthroughChart;
	/** 双语三档，默认 both（中文主文 + 括注原文） */
	lang?: ChartLang;
	/** 只看某个角色（c1/c2…）；null/undefined 表示全部路线 */
	characterKey?: string | null;
	/** 「在路线列表中查看」：壳切到「按顺序」视图并滚到该段 */
	onOpenSegment?: (segmentKey: string) => void;
	/** 渲染在全屏 Modal 里：桌面仍是左右分栏，窄屏把选项收进抽屉、把高度让给画布 */
	fullscreen?: boolean;
	/** 操作按钮里的「全屏 / 退出全屏」；不传就不画这个按钮 */
	onToggleFullscreen?: () => void;
	/** 节点数兜底，超过就只提示选角色（默认 200） */
	maxNodes?: number;
	className?: string;
}

/*
 * 布局常量（像素）。节点是 HTML 绝对定位、连线是 SVG，两者共用同一套坐标，
 * 所以宽高必须是常量：文字换行交给 truncate，不参与测量 -> 渲染期一次算完，
 * 不会因为测量回流变成 O(n²)。
 *
 * 方向按参考站来：**自上而下**一条主干，分支向左右两侧展开。改造前是横向
 * 分层（层 → x），一行里挤进十几个节点，22 步的段落被画成一根横线，
 * 存档点只能散在下面几行 —— 和参考站的读法完全不同。
 */
const NODE_WIDTH = 184;
const NODE_HEIGHT = 40;
const COL_STEP = 224;
const ROW_STEP = 92;
const MARGIN = 24;

/** 缩放下限 0.3 / 上限 2：再小字就糊，再大只是把细节放大 */
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const clampScale = (value: number) =>
	Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

/**
 * 触屏上「拖完抬手」浏览器还会补一次 click：累计位移超过这个像素就不再算点击，
 * 否则捏合/滑动看图的收尾会被当成点了某个节点。
 */
const CLICK_SLOP = 8;

/** 手势停手后隔多久撤掉 will-change（让浏览器按静止缩放重新栅格化文字） */
const SETTLE_MS = 180;

/**
 * 粗指针（触屏）：没有滚轮，画布手势是「单指拖拽平移 + 双指捏合缩放」，
 * 左下角的提示文案要跟着换一套。
 */
function useCoarsePointer() {
	const [coarse, setCoarse] = useState(false);
	useEffect(() => {
		if (typeof window.matchMedia !== "function") return;
		const media = window.matchMedia("(pointer: coarse)");
		const update = () => setCoarse(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, []);
	return coarse;
}

/**
 * 画布底：借用标签层级图（tags/[tagId]）那一套 —— 点阵网格 + 中心柔光，
 * 底色是 muted 混 card，比纯白更「像一块画布」，也让节点卡片浮得起来。
 */
const GRID = 26;
const CANVAS_BG = "color-mix(in oklch, var(--muted) 28%, var(--card))";
const DOT = "color-mix(in oklch, var(--muted-foreground) 30%, transparent)";
const SPOTLIGHT =
	"radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 13%, transparent), transparent 58%)";

/**
 * 连线与选中态。标签层级图里：普通连线是 muted-foreground/30 的细线，
 * 只有「汇入当前节点」的那几段用 primary/60 加粗 —— 这里照搬同一套层级表达，
 * 不再给流程图画一套独立的亮蓝。
 */
const EDGE_IDLE = "text-muted-foreground/30";
const EDGE_HOVER = "text-primary/50";
const EDGE_SELECTED = "text-primary";

/**
 * 节点配色（借标签层级图的卡片语言）。
 *
 * - 所有节点同一形状：固定尺寸、圆角、居中截断的单行文字；
 * - 存档 = 卡底 + 发丝边（层级图里的「普通节点」）；
 * - 起点 / 结局 = 只给**极浅的底色 + 同色边**，文字仍是正文色 —— 层级图里
 *   颜色只用来标「当前」，语义色因此压到最低，避免整张图五颜六色；
 * - 回收 / 未标注终点 = 虚线弱化（层级图里「不可点击的祖先」同款）。
 */
const ENDING_TONE: Record<ChartEndingType, string> = {
	heroine:
		"border-sky-500/40 bg-sky-500/10 dark:border-sky-400/35 dark:bg-sky-400/10",
	after:
		"border-teal-500/40 bg-teal-500/10 dark:border-teal-400/35 dark:bg-teal-400/10",
	true: "border-amber-500/45 bg-amber-500/12 dark:border-amber-400/40 dark:bg-amber-400/10",
	normal:
		"border-slate-500/40 bg-slate-500/10 dark:border-slate-400/35 dark:bg-slate-400/10",
	harem:
		"border-violet-500/40 bg-violet-500/10 dark:border-violet-400/35 dark:bg-violet-400/10",
	bad: "border-rose-500/40 bg-rose-500/10 dark:border-rose-400/35 dark:bg-rose-400/10",
	other: "border-border/80 bg-muted/40",
};

const NODE_TYPE_TONE: Record<
	Exclude<ChartNode["node_type"], "ending">,
	string
> = {
	entry:
		"border-emerald-500/45 bg-emerald-500/12 dark:border-emerald-400/40 dark:bg-emerald-400/10",
	save: "border-border/80 bg-card",
	collect: "border-dashed border-border/70 bg-muted/25 text-muted-foreground",
	open: "border-dashed border-border/70 bg-muted/25 text-muted-foreground",
};

/** 选中与 hover：完全复用层级图「当前节点」的那一圈柔光环 */
const SELECTED_RING = "ring-[3px] ring-primary/20";
const HOVER_RING = "ring-2 ring-primary/15";

interface GraphNode {
	id: ChartNodeId;
	node: ChartNode;
	label: ChartText;
	ending: ChartEnding | null;
	layer: number;
	x: number;
	y: number;
}

interface GraphEdge {
	key: string;
	chunk: ChartEdgeChunk;
	from: GraphNode;
	to: GraphNode;
	path: string;
	labelX: number;
	labelY: number;
}

/**
 * 分层：Kahn 拓扑排序取「最早可到达的层 +1」= 最长路径分层（层 = 纵向行号）。
 * 存档回跳可能造出回边/环，剩下的节点统一丢到最后一层，绝不死循环。
 */
function assignLayers(
	ids: ChartNodeId[],
	pairs: Array<[ChartNodeId, ChartNodeId]>,
): Map<ChartNodeId, number> {
	const index = new Map(ids.map((id, i) => [id, i]));
	const outgoing: number[][] = ids.map(() => []);
	const indegree = ids.map(() => 0);
	const seen = new Set<string>();

	for (const [from, to] of pairs) {
		const a = index.get(from);
		const b = index.get(to);
		if (a === undefined || b === undefined || a === b) continue;
		const pairKey = `${a}>${b}`;
		if (seen.has(pairKey)) continue;
		seen.add(pairKey);
		outgoing[a].push(b);
		indegree[b] += 1;
	}

	const layer = ids.map(() => 0);
	const queue: number[] = [];
	for (let i = 0; i < ids.length; i += 1) {
		if (indegree[i] === 0) queue.push(i);
	}
	for (let head = 0; head < queue.length; head += 1) {
		const i = queue[head];
		for (const j of outgoing[i]) {
			layer[j] = Math.max(layer[j], layer[i] + 1);
			indegree[j] -= 1;
			if (indegree[j] === 0) queue.push(j);
		}
	}

	const maxLayer = layer.length > 0 ? Math.max(...layer) : 0;
	for (let i = 0; i < ids.length; i += 1) {
		if (indegree[i] > 0) layer[i] = maxLayer + 1;
	}

	return new Map(ids.map((id, i) => [id, layer[i]]));
}

/** 连线：默认自上而下的一条贝塞尔；同层/回边从侧面绕，避免和主干重叠。 */
function edgePath(from: GraphNode, to: GraphNode): string {
	const x1 = from.x + NODE_WIDTH / 2;
	const y1 = from.y + NODE_HEIGHT;
	const x2 = to.x + NODE_WIDTH / 2;
	const y2 = to.y;
	if (y2 - y1 >= 24) {
		const mid = (y1 + y2) / 2;
		return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
	}
	const bend = Math.max(36, Math.abs(x2 - x1) / 3);
	return `M ${x1} ${y1} C ${x1 + bend} ${y1 + 48}, ${x2 - bend} ${y2 - 48}, ${x2} ${y2}`;
}

/**
 * 一次算完节点/连线/画布尺寸；调用方用 useMemo 包住，交互只改 hover 状态。
 *
 * 主干判定：每个节点把「最深的孩子」当主干（层号最大），主干继承父节点的
 * 横向列；其余孩子作为分支左右交替展开。这样一条路线读下来是笔直向下的，
 * 结局/回收分支挂在旁边 —— 与参考站的读法一致。
 */
function buildGraph(
	chunks: ChartEdgeChunk[],
	chart: WalkthroughChart,
	lang: ChartLang,
) {
	/**
	 * 节点身份：有 key 的节点按 chart 里的 key 去重（同一存档/结局出现多次只画一个）；
	 * collect / open 的 key 恒为 null（上游只给类型），按「哪条边到达它」区分 ——
	 * 否则「存档 05 回收」和「存档 06 回收」会被并成同一个节点，图上多出一条
	 * 跨两个存档的回边。参考站也是每个到达点各画一个「回收后…」。
	 */
	const nodeKey = (node: ChartNode, chunk: ChartEdgeChunk): ChartNodeId =>
		node.key === null ? `${chartNodeId(node)}#${chunk.id}` : chartNodeId(node);

	const nodesById = new Map<ChartNodeId, ChartNode>();
	const order: ChartNodeId[] = [];
	for (const chunk of chunks) {
		for (const node of [chunk.from, chunk.to]) {
			const id = nodeKey(node, chunk);
			if (nodesById.has(id)) continue;
			nodesById.set(id, node);
			order.push(id);
		}
	}

	const outgoing = new Map<ChartNodeId, ChartNodeId[]>(
		order.map((id) => [id, []]),
	);
	const indegree = new Map<ChartNodeId, number>(order.map((id) => [id, 0]));
	const pairs: Array<[ChartNodeId, ChartNodeId]> = [];
	const seenPairs = new Set<string>();
	for (const chunk of chunks) {
		const from = nodeKey(chunk.from, chunk);
		const to = nodeKey(chunk.to, chunk);
		const pair = `${from}>${to}`;
		if (seenPairs.has(pair)) continue;
		seenPairs.add(pair);
		if (from === to) continue;
		pairs.push([from, to]);
		outgoing.get(from)?.push(to);
		indegree.set(to, (indegree.get(to) ?? 0) + 1);
	}

	const layers = assignLayers(order, pairs);

	/**
	 * 主干：**按源文顺序的第一个孩子**当主干，其余是分支。
	 *
	 * 不能用「层号最大的孩子」：存档点会把主干劈开（存档 03 既通往存档 04，
	 * 又通往坏结局），后者层号更深，结果主干一路走到最后一个存档、结局被甩到
	 * 侧边，再靠回边接回存档 06 —— 读起来是断的。第一孩子正好是「本段继续
	 * 往下写的那个方向」（chart 里段内步骤在前、分支段在后），所以主干是直的。
	 */
	const mainChild = new Map<ChartNodeId, ChartNodeId>();
	for (const id of order) {
		const children = outgoing.get(id) ?? [];
		if (children.length === 0) continue;
		mainChild.set(id, children[0] as ChartNodeId);
	}

	// 横向列：主干继承父节点，分支左右交替；没有入边的起点（多个入口）顺次往右排
	const lane = new Map<ChartNodeId, number>();
	let rightmost = 0;
	const roots = order.filter((id) => (indegree.get(id) ?? 0) === 0);
	for (const root of roots) {
		lane.set(root, rightmost);
		rightmost += 1;
	}
	const visited = new Set<ChartNodeId>();
	const queue = [...roots];
	for (let head = 0; head < queue.length; head += 1) {
		const id = queue[head];
		if (!id || visited.has(id)) continue;
		visited.add(id);
		const children = outgoing.get(id) ?? [];
		const main = mainChild.get(id);
		let branchIndex = 0;
		for (const child of children) {
			queue.push(child);
			if (lane.has(child)) continue;
			if (child === main) {
				lane.set(child, lane.get(id) ?? 0);
				continue;
			}
			branchIndex += 1;
			const offset =
				Math.ceil(branchIndex / 2) * (branchIndex % 2 === 1 ? -1 : 1);
			lane.set(child, (lane.get(id) ?? 0) + offset);
		}
	}
	for (const id of order) {
		if (lane.has(id)) continue;
		lane.set(id, rightmost);
		rightmost += 1;
	}

	const minLane = Math.min(...lane.values());
	const nodes: GraphNode[] = order.map((id) => {
		const node = nodesById.get(id) as ChartNode;
		return {
			id,
			node,
			label: nodeLabel(chart, node, lang),
			ending:
				node.node_type === "ending"
					? ((chart.endings ?? []).find((ending) => ending.key === node.key) ??
						null)
					: null,
			layer: layers.get(id) ?? 0,
			x: MARGIN + ((lane.get(id) ?? 0) - minLane) * COL_STEP,
			y: MARGIN + (layers.get(id) ?? 0) * ROW_STEP,
		};
	});

	// 同层防撞：理论上同层不同列，但主干判定异常时可能挤到同一列，向右让开
	const byLayer = new Map<number, GraphNode[]>();
	for (const node of nodes) {
		const row = byLayer.get(node.layer) ?? [];
		row.push(node);
		byLayer.set(node.layer, row);
	}
	for (const row of byLayer.values()) {
		row.sort((a, b) => a.x - b.x);
		for (let i = 1; i < row.length; i += 1) {
			const gap = row[i].x - row[i - 1].x;
			if (gap < COL_STEP) row[i].x = row[i - 1].x + COL_STEP;
		}
	}

	const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
	const edges: GraphEdge[] = [];
	for (const chunk of chunks) {
		const from = nodeIndex.get(nodeKey(chunk.from, chunk));
		const to = nodeIndex.get(nodeKey(chunk.to, chunk));
		if (!from || !to) continue;
		edges.push({
			key: chunk.id,
			chunk,
			from,
			to,
			path: edgePath(from, to),
			labelX: (from.x + to.x) / 2 + NODE_WIDTH / 2,
			labelY: (from.y + NODE_HEIGHT + to.y) / 2,
		});
	}

	// 点节点时回跳它出发的第一条边：预建映射，避免渲染时再扫一遍
	const firstEdgeFrom = new Map<ChartNodeId, GraphEdge>();
	const firstEdgeTo = new Map<ChartNodeId, GraphEdge>();
	for (const edge of edges) {
		if (!firstEdgeFrom.has(edge.from.id)) firstEdgeFrom.set(edge.from.id, edge);
		if (!firstEdgeTo.has(edge.to.id)) firstEdgeTo.set(edge.to.id, edge);
	}

	const maxX = nodes.reduce((m, n) => Math.max(m, n.x), 0);
	const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0);

	return {
		nodes,
		edges,
		firstEdgeFrom,
		firstEdgeTo,
		width: maxX + NODE_WIDTH + MARGIN,
		height: maxY + NODE_HEIGHT + MARGIN,
	};
}

/** 节点前的图标：起点=播放三角、存档=存档盘、结局=旗子（与截图一致） */
function NodeIcon({ node }: { node: ChartNode }) {
	const className = "size-3.5 shrink-0";
	switch (node.node_type) {
		case "entry":
			return <Play aria-hidden className={className} />;
		case "save":
			return <Save aria-hidden className={className} />;
		case "ending":
			return <Flag aria-hidden className={className} />;
		case "collect":
			return <CornerDownRight aria-hidden className={className} />;
		default:
			return <CornerDownRight aria-hidden className={className} />;
	}
}

/**
 * 小图例：颜色含义，壳的「符号说明」讲的是源文里的 ★/⇒，这里只讲配色。
 *
 * 色块直接用节点同一套 tone 类（不再一律画灰块）：图上「起点是绿的、存档
 * 是卡的底色、结局按线染色」这些信息，图例必须能对上号，否则图例等于没写。
 */
function NodeLegend() {
	const items = [
		{ label: "起点", tone: NODE_TYPE_TONE.entry },
		{ label: "存档", tone: NODE_TYPE_TONE.save },
		{ label: "回收 CG / 场景", tone: NODE_TYPE_TONE.collect },
		{ label: "结局（按线路染色）", tone: ENDING_TONE.heroine },
		{ label: "未标注终点", tone: NODE_TYPE_TONE.open },
	];
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{items.map(({ label, tone }) => (
				<span
					className="flex items-center gap-1.5 rounded-full border border-border/60 bg-popover/85 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur"
					key={label}
				>
					<span className={cn("size-2.5 rounded-sm border", tone)} />
					{label}
				</span>
			))}
		</div>
	);
}

/**
 * 「流程图」视图。
 *
 * 数据模型：段落（segment）按存档点切成边（见 chartEdgeChunks），所以图上
 * 的流程是 START —3 个选项→ ◆存档01 —1 个选项→ ◆存档02 … 这样一段一段
 * 接起来的，和参考站一致；标签「N 个选项」= 这条边上的 choice/action 数，
 * 没有选项的边写「查看步骤」。
 *
 * 交互：点边 / 点节点 → 选项面板显示这一段要选的选项（渲染复用顺序视图的
 * StepRow），面板底部「在路线列表中查看」切回顺序视图并滚到该段。
 *
 * 布局随容器走，而不是随「内联 / 全屏」两套组件走：
 * - lg 以上：画布在左、选项面板固定在右侧（用户明确要求「将选项放到右边」）；
 * - lg 以下：面板叠在画布下方，边点边看，不用再开一层弹层；
 * - 全屏 Modal 里的 lg 以下：下面没有画布外的空间，改为点边时弹底部抽屉，
 *   把整块高度留给图。
 */
export function GraphView({
	chart,
	lang = "both",
	characterKey = null,
	onOpenSegment,
	fullscreen = false,
	onToggleFullscreen,
	maxNodes = 200,
	className,
}: GraphViewProps) {
	const markerId = `wt-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const activeMarkerId = `${markerId}-active`;
	const chunks = useMemo(
		() => chartEdgeChunks(chart, characterKey),
		[chart, characterKey],
	);
	const graph = useMemo(
		() => buildGraph(chunks, chart, lang),
		[chunks, chart, lang],
	);

	// 窄屏（<1024，与右侧栏的 lg 断点同一口径）。
	// 用 1024 而不是 768：768–1023 的平板放 340px 侧栏后画布只剩三百多像素。
	// 首帧按桌面渲染，effect 后再切，SSR/水合一致。
	const isNarrow = useIsNarrow(1024);
	const coarse = useCoarsePointer();
	const [hoverNode, setHoverNode] = useState<ChartNodeId | null>(null);
	const [optionsOpen, setOptionsOpen] = useState(false);

	// 旋屏 / 拉宽到桌面断点、或退出全屏时把抽屉收掉：其它情形都能直接看到
	// 选项面板，再留一层抽屉只是多一块遮罩
	useEffect(() => {
		if (!isNarrow || !fullscreen) setOptionsOpen(false);
	}, [isNarrow, fullscreen]);
	const [hoverEdge, setHoverEdge] = useState<string | null>(null);
	const [activeChunkId, setActiveChunkId] = useState<string | null>(null);

	/**
	 * 视图变换（缩放 / 平移）刻意**不进 React state**。
	 *
	 * 滚轮和拖拽每秒会触发几十上百次；只要 setState，整棵树（200 个节点 +
	 * 200 条连线 + 200 个选项标签）就会跟着重渲染一遍，低端机上直接掉帧。
	 * 这里把变换只留在 ref 里，并把位移 / 缩放 / 网格背景 / 缩放读数直接写 DOM——
	 * 手势期间一次 React 渲染都不会发生，只有选中项 / hover 变化才重渲染。
	 *
	 * 缩放**不能写成 `transform: scale()`**：那等于把已经按 100% 栅格化好的
	 * 位图交给合成器放大，放大后节点和「N 个选项」的字是糊的（再叠上
	 * `will-change: transform` 更糟 —— 层被永久提升，文字连亚像素抗锯齿都没了，
	 * 静止时就已经发虚）。所以这里拆成两层：
	 * - 外层（panRef）只写 `translate()`：平移是纯位移，字不会被重新采样；
	 * - 内层（zoomRef）写 CSS `zoom`：缩放走**布局**，浏览器按缩放后的字号重新
	 *   栅格化字形，100%～200% 都是锐利的（`zoom` 现在是 CSS Viewport 规范的一部分，
	 *   Chrome / Safari / Firefox 126+ 都支持；只有很老的浏览器会退化成「不缩放」，
	 *   但拖拽、点选仍然可用）。
	 * 平移/捏合进行中临时给外层挂 `will-change: transform`（手势里没人逐字看，
	 * 合成层只负责别掉帧），停手 SETTLE_MS 后立刻撤掉，让浏览器按静止状态重新
	 * 栅格化 —— 否则刚放大的那一下会一直糊着。
	 */
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const panRef = useRef<HTMLDivElement | null>(null);
	const zoomRef = useRef<HTMLDivElement | null>(null);
	const pctRef = useRef<HTMLSpanElement | null>(null);
	const viewRef = useRef({ scale: 1, x: 0, y: 0 });
	/** 上一次真正写进 DOM 的变换：缩放/位移没变就不再碰 DOM */
	const appliedRef = useRef<{ scale: number; x: number; y: number } | null>(
		null,
	);
	const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	/** 滚轮增量合并：同一帧里常有三到十个 wheel 事件，合并成一次重排 */
	const wheelPendingRef = useRef({ steps: 0, x: 0, y: 0 });
	const wheelFrameRef = useRef(0);

	/** 手势进行中：临时把平移层交给合成器，停手后撤销（见上面的注释） */
	const markMoving = useCallback(() => {
		const pan = panRef.current;
		// 手势里每帧都会调：值没变就别再制造一次样式失效
		if (pan && pan.style.willChange !== "transform") {
			pan.style.willChange = "transform";
		}
		if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
		settleTimerRef.current = setTimeout(() => {
			settleTimerRef.current = null;
			if (panRef.current) panRef.current.style.willChange = "";
		}, SETTLE_MS);
	}, []);

	const applyView = useCallback(
		(next: { scale: number; x: number; y: number }) => {
			viewRef.current = next;
			const element = viewportRef.current;
			if (element) {
				// 网格跟着平移/缩放走：拖动画布时底纹有位移感，而不是贴在视口上。
				// 尺寸只在缩放变化时写（平移时它不变），少一次无意义的样式失效。
				const size = `100% 100%, ${GRID * next.scale}px ${GRID * next.scale}px`;
				if (element.style.backgroundSize !== size) {
					element.style.backgroundSize = size;
				}
				element.style.backgroundPosition = `0 0, ${next.x}px ${next.y}px`;
			}
			const applied = appliedRef.current;
			// 平移层：只写位移。CSS 会把小数原样保留，视觉上是亚像素移动，不会变糊
			const pan = panRef.current;
			if (pan) {
				pan.style.transform = `translate(${next.x}px, ${next.y}px)`;
			}
			// 缩放层：zoom 走布局。只有缩放变化才碰它（平移时重排一次都是浪费）
			if (zoomRef.current && (!applied || applied.scale !== next.scale)) {
				zoomRef.current.style.zoom = String(next.scale);
			}
			appliedRef.current = next;
			// 读数只在缩放真的变了才写：平移时 scale 不变，textContent 赋值同样会
			// 触发一次 DOM mutation，拖拽期间白白多几百次
			if (pctRef.current) {
				const label = `${Math.round(next.scale * 100)}%`;
				if (pctRef.current.textContent !== label) {
					pctRef.current.textContent = label;
				}
			}
		},
		[],
	);

	useEffect(
		() => () => {
			if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
			if (wheelFrameRef.current) cancelAnimationFrame(wheelFrameRef.current);
		},
		[],
	);
	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		originX: number;
		originY: number;
	} | null>(null);
	/** 触屏手势：同时按下的指针（双指 = 捏合缩放） */
	const pointersRef = useRef(new Map<number, { x: number; y: number }>());
	/**
	 * 捏合基准：开始时两指的间距/中点 + 当时的视图。
	 *
	 * 手机上缩放只能靠双指（没有滚轮），工具条的 ± 按钮只是单指退路 —— 没有
	 * 这段捏合，两根手指在画布上一叉，`touch-action: none` 又把浏览器的页面
	 * 缩放关掉了，结果就是「怎么捏都没反应」。
	 */
	const pinchRef = useRef<{
		dist: number;
		midX: number;
		midY: number;
		scale: number;
		x: number;
		y: number;
	} | null>(null);
	/** 本次按下累计的位移：触屏抬手后浏览器补的那次 click 靠它决定吞不吞 */
	const movedRef = useRef(0);

	// 选中态：管理一个 id，找不到就退回第一条边（切换角色/换攻略时自动归位）
	const activeEdge =
		graph.edges.find((edge) => edge.key === activeChunkId) ??
		graph.edges[0] ??
		null;
	const activeChunk = activeEdge?.chunk ?? null;

	const fitToView = useCallback(() => {
		const element = viewportRef.current;
		if (!element || typeof window === "undefined") return;
		const width = element.clientWidth;
		const height = element.clientHeight;
		if (!width || !height) return;
		// 下限定在 0.7：整条路线（多角色全开）可能有十几列，硬塞进画布会把
		// 「N 个选项」缩成看不清的灰点 —— 宁可让画布可拖拽，也不做到看不清的自适应
		const scale = clampScale(
			Math.min(
				1.1,
				Math.max(
					0.7,
					Math.min(
						(width - 48) / Math.max(graph.width, 1),
						(height - 48) / Math.max(graph.height, 1),
					),
				),
			),
		);
		const contentHeight = graph.height * scale;
		applyView({
			scale,
			x: (width - graph.width * scale) / 2,
			// 放得下就居中，放不下从顶部起排（往下拖看后续，而不是从中间截断）
			y: contentHeight <= height - 32 ? (height - contentHeight) / 2 : 16,
		});
	}, [applyView, graph.width, graph.height]);

	// 首屏与切角色后自适应；jsdom 里 clientWidth=0 直接跳过（单测不需要布局）
	useEffect(() => {
		fitToView();
	}, [fitToView]);

	/**
	 * 滚轮缩放必须挂在原生监听上：React 的 onWheel 是 passive，preventDefault 无效。
	 *
	 * 事件按帧合并：触控板一帧能派发三到十个 wheel，而缩放现在走布局（见 applyView），
	 * 一次写入就是一次重排；合并之后一帧最多重排一次。
	 */
	useEffect(() => {
		const element = viewportRef.current;
		if (!element) return;
		const flush = () => {
			wheelFrameRef.current = 0;
			const pending = wheelPendingRef.current;
			wheelPendingRef.current = { steps: 0, x: pending.x, y: pending.y };
			if (!pending.steps) return;
			const current = viewRef.current;
			const scale = clampScale(current.scale * 1.12 ** pending.steps);
			if (scale === current.scale) return;
			markMoving();
			// 光标下的那个点缩放前后必须重合：只量一次包围盒（一次重排的代价）
			const rect = element.getBoundingClientRect();
			const cx = pending.x - rect.left;
			const cy = pending.y - rect.top;
			const ratio = scale / current.scale;
			applyView({
				scale,
				x: cx - (cx - current.x) * ratio,
				y: cy - (cy - current.y) * ratio,
			});
		};
		const handleWheel = (event: WheelEvent) => {
			event.preventDefault();
			const steps = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0;
			if (steps === 0) return;
			const pending = wheelPendingRef.current;
			pending.steps += steps;
			pending.x = event.clientX;
			pending.y = event.clientY;
			if (!wheelFrameRef.current) {
				wheelFrameRef.current = requestAnimationFrame(flush);
			}
		};
		element.addEventListener("wheel", handleWheel, { passive: false });
		return () => {
			element.removeEventListener("wheel", handleWheel);
			if (wheelFrameRef.current) cancelAnimationFrame(wheelFrameRef.current);
			wheelFrameRef.current = 0;
		};
	}, [applyView, markMoving]);

	/** 以画布中心为锚点缩放（工具条的 ± 按钮） */
	const zoomBy = useCallback(
		(factor: number) => {
			const current = viewRef.current;
			const scale = clampScale(current.scale * factor);
			if (scale === current.scale) return;
			const element = viewportRef.current;
			const width = element?.clientWidth ?? 0;
			const height = element?.clientHeight ?? 0;
			const ratio = scale / current.scale;
			applyView({
				scale,
				x: width / 2 - (width / 2 - current.x) * ratio,
				y: height / 2 - (height / 2 - current.y) * ratio,
			});
		},
		[applyView],
	);

	const resetView = useCallback(() => {
		applyView({ scale: 1, x: 0, y: 0 });
	}, [applyView]);

	/** 进入双指捏合：记下基准，把在途的单指拖拽丢掉，并接管两根手指 */
	const beginPinch = (element: HTMLDivElement) => {
		const [a, b] = [...pointersRef.current.values()];
		if (!a || !b) return;
		const view = viewRef.current;
		pinchRef.current = {
			dist: Math.hypot(a.x - b.x, a.y - b.y),
			midX: (a.x + b.x) / 2,
			midY: (a.y + b.y) / 2,
			scale: view.scale,
			x: view.x,
			y: view.y,
		};
		dragRef.current = null;
		movedRef.current = CLICK_SLOP + 1;
		// 捏合时两根手指常常压在画布边缘：抓住指针，滑到面板/画布外也不丢事件
		for (const id of pointersRef.current.keys()) {
			element.setPointerCapture?.(id);
		}
	};

	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		const target = event.target as HTMLElement;
		// 工具条/提示浮层：一旦在它们上面开始拖拽，setPointerCapture 会把后续
		// click 重定向到画布，按钮就彻底点不动了
		if (target.closest("[data-overlay]")) return;

		if (event.pointerType === "touch") {
			// 触屏不 setPointerCapture：节点/标签的 click 要留在自己身上，否则
			// 从节点上起手拖动画布之后，抬手那次 click 会被重定向到画布、点不中。
			// 两个手指都落在画布子树里，pointermove 照常冒泡到视口，捏合不缺事件。
			movedRef.current = 0;
			pointersRef.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			markMoving();
			if (pointersRef.current.size >= 2) {
				beginPinch(event.currentTarget);
				return;
			}
			dragRef.current = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				originX: viewRef.current.x,
				originY: viewRef.current.y,
			};
			return;
		}

		// 鼠标/触控笔：节点/标签自己处理点击，拖拽只从空白画布开始
		if (target.closest("[data-node-id], [data-edge-key], [data-edge-label]")) {
			return;
		}
		movedRef.current = 0;
		dragRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: viewRef.current.x,
			originY: viewRef.current.y,
		};
		event.currentTarget.setPointerCapture?.(event.pointerId);
		markMoving();
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "touch") {
			if (!pointersRef.current.has(event.pointerId)) return;
			pointersRef.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			const pinch = pinchRef.current;
			const pointers = [...pointersRef.current.values()];
			if (pinch && pointers.length >= 2) {
				const [a, b] = pointers;
				if (!a || !b) return;
				const dist = Math.hypot(a.x - b.x, a.y - b.y);
				if (pinch.dist <= 0 || dist <= 0) return;
				const rect = event.currentTarget.getBoundingClientRect();
				const scale = clampScale(pinch.scale * (dist / pinch.dist));
				// 捏合开始时压在两指中点下的那个图坐标点，捏合后要落回新的中点下；
				// 两指整体平移 = 中点跟着动，顺带把平移也做了
				const fromX = pinch.midX - rect.left;
				const fromY = pinch.midY - rect.top;
				const toX = (a.x + b.x) / 2 - rect.left;
				const toY = (a.y + b.y) / 2 - rect.top;
				const graphX = (fromX - pinch.x) / pinch.scale;
				const graphY = (fromY - pinch.y) / pinch.scale;
				movedRef.current = CLICK_SLOP + 1;
				markMoving();
				applyView({
					scale,
					x: toX - graphX * scale,
					y: toY - graphY * scale,
				});
				return;
			}
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			const dx = event.clientX - drag.startX;
			const dy = event.clientY - drag.startY;
			movedRef.current = Math.hypot(dx, dy);
			// 位移过阈值才接管指针：此前还可能是「点节点」，capture 会把那次 click
			// 重定向到画布；一旦确认是在拖，抓住指针才不会被滑出画布丢掉事件
			if (
				movedRef.current > CLICK_SLOP &&
				!event.currentTarget.hasPointerCapture?.(event.pointerId)
			) {
				event.currentTarget.setPointerCapture?.(event.pointerId);
			}
			markMoving();
			applyView({
				scale: viewRef.current.scale,
				x: drag.originX + dx,
				y: drag.originY + dy,
			});
			return;
		}

		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		movedRef.current = Math.hypot(
			event.clientX - drag.startX,
			event.clientY - drag.startY,
		);
		// 直接写 DOM，不 setState：拖动时每帧都有 pointermove，
		// 走 React 会把整棵树重渲染（见 applyView 的注释）
		markMoving();
		applyView({
			scale: viewRef.current.scale,
			x: drag.originX + (event.clientX - drag.startX),
			y: drag.originY + (event.clientY - drag.startY),
		});
	};

	const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "touch") {
			pointersRef.current.delete(event.pointerId);
			if (pointersRef.current.size < 2) pinchRef.current = null;
			const [remaining] = [...pointersRef.current.entries()];
			if (pointersRef.current.size === 1 && remaining) {
				// 捏合中途松开一根，剩下的那根继续平移而不是卡住：
				// 以它当前的位置作为新的拖拽起点
				dragRef.current = {
					pointerId: remaining[0],
					startX: remaining[1].x,
					startY: remaining[1].y,
					originX: viewRef.current.x,
					originY: viewRef.current.y,
				};
			} else {
				dragRef.current = null;
			}
			if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			return;
		}
		dragRef.current = null;
		if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	// hover 时把与当前对象无关的连线/节点压暗，一眼看出这条路径去哪儿
	const highlight = useMemo(() => {
		if (hoverEdge) {
			const edge = graph.edges.find((item) => item.key === hoverEdge);
			if (!edge) return null;
			return {
				edges: new Set([edge.key]),
				nodes: new Set<ChartNodeId>([edge.from.id, edge.to.id]),
			};
		}
		if (hoverNode) {
			const edges = graph.edges.filter(
				(edge) => edge.from.id === hoverNode || edge.to.id === hoverNode,
			);
			const nodes = new Set<ChartNodeId>([hoverNode]);
			for (const edge of edges) {
				nodes.add(edge.from.id);
				nodes.add(edge.to.id);
			}
			return { edges: new Set(edges.map((edge) => edge.key)), nodes };
		}
		return null;
	}, [graph, hoverNode, hoverEdge]);

	if (graph.edges.length === 0) {
		const emptyText =
			(chart.segments ?? []).length === 0
				? "这份攻略还没有选项数据"
				: "这条路线还没有选项数据";
		return (
			<div
				className={cn(
					"rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground text-sm",
					className,
				)}
			>
				{emptyText}
			</div>
		);
	}

	// 大图兜底：节点挤在一起没有读的意义，把决定权交回给角色筛选
	if (graph.nodes.length > maxNodes) {
		return (
			<div
				className={cn(
					"rounded-xl border border-dashed border-border px-4 py-10 text-center",
					className,
				)}
			>
				<p className="text-foreground text-sm">流程图过大，请选择角色查看</p>
				<p className="mt-1 text-muted-foreground text-xs">
					当前 {graph.nodes.length} 个节点，上限 {maxNodes} 个
				</p>
			</div>
		);
	}

	/**
	 * 全屏里的窄屏没有「画布下方的面板」：点边/点节点时弹底部抽屉。
	 * 内联时面板就在画布下面，点完直接更新那一块，不再多开一层。
	 */
	const revealOptions = () => {
		if (fullscreen && isNarrow) setOptionsOpen(true);
	};
	const selectEdge = (edge: GraphEdge) => {
		setActiveChunkId(edge.key);
		revealOptions();
	};
	const selectNode = (node: GraphNode) => {
		const edge =
			graph.firstEdgeFrom.get(node.id) ?? graph.firstEdgeTo.get(node.id);
		if (!edge) return;
		setActiveChunkId(edge.key);
		revealOptions();
	};

	return (
		<>
			<div
				className={cn(
					"flex min-h-0 flex-col gap-2",
					// 内联时给一个固定高度（absolute inset-0 的画布必须有确定高度，
					// 不能靠内容撑开）；全屏时由 Modal 的内容区给高度
					// 用 dvh 而不是 vh：手机浏览器地址栏收起/展开时 vh 不会重算，
					// 画布会有一截被裁掉
					fullscreen ? "h-full" : "h-[min(72dvh,640px)]",
					className,
				)}
			>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/30 lg:flex-row">
					<div className="relative min-h-0 flex-1" data-graph-canvas>
						{/* 画布 */}
						<div className="absolute inset-0">
							<div
								className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
								data-graph-viewport
								// 触屏上拖完抬手浏览器还会补一次 click：位移超过阈值就吞掉它，
								// 否则「捏合 / 滑动看图」的收尾会被当成点了某个节点
								onClickCapture={(event) => {
									if (movedRef.current <= CLICK_SLOP) return;
									movedRef.current = 0;
									event.preventDefault();
									event.stopPropagation();
								}}
								onPointerCancel={endDrag}
								onPointerDown={handlePointerDown}
								onPointerMove={handlePointerMove}
								onPointerUp={endDrag}
								ref={viewportRef}
								style={{
									// 标签层级图同款：点阵网格 + 中心柔光。网格的尺寸/位移由
									// applyView 直接写 DOM（跟着平移/缩放走），这里只给初始值
									backgroundColor: CANVAS_BG,
									backgroundImage: `${SPOTLIGHT}, radial-gradient(circle, ${DOT} 1px, transparent 1px)`,
									backgroundSize: `100% 100%, ${GRID}px ${GRID}px`,
									backgroundPosition: "0 0, 0px 0px",
								}}
							>
								{/* 平移层：只写 translate。缩放不能写在这里 —— */}
								{/* transform: scale 是把 100% 栅格化的位图交给合成器放大，字会糊 */}
								<div
									className="absolute top-0 left-0"
									data-graph-content
									ref={panRef}
									style={{ transformOrigin: "0 0" }}
								>
									{/* 缩放层：CSS zoom 走布局，浏览器按缩放后的字号重新栅格化字形 */}
									<div
										className="relative"
										data-graph-scaler
										ref={zoomRef}
										style={{ width: graph.width, height: graph.height }}
									>
										<svg
											aria-hidden
											className="pointer-events-none absolute inset-0"
											height={graph.height}
											viewBox={`0 0 ${graph.width} ${graph.height}`}
											width={graph.width}
										>
											<defs>
												<marker
													id={markerId}
													markerHeight="6"
													markerWidth="6"
													orient="auto-start-reverse"
													refX="9"
													refY="5"
													viewBox="0 0 10 10"
												>
													{/* marker 内容不继承引用者颜色，这里固定成弱化的连线色 */}
													<path
														className="text-muted-foreground/40"
														d="M 0 0 L 10 5 L 0 10 z"
														fill="currentColor"
													/>
												</marker>
												{/* 选中边的箭头单独一份：和 primary 描边同一色，不跟灰线混 */}
												<marker
													id={activeMarkerId}
													markerHeight="7"
													markerWidth="7"
													orient="auto-start-reverse"
													refX="9"
													refY="5"
													viewBox="0 0 10 10"
												>
													<path
														className="text-primary"
														d="M 0 0 L 10 5 L 0 10 z"
														fill="currentColor"
													/>
												</marker>
											</defs>
											{graph.edges.map((edge) => {
												const dimmed =
													highlight !== null && !highlight.edges.has(edge.key);
												const hovered = highlight?.edges.has(edge.key) ?? false;
												const selected = activeEdge?.key === edge.key;
												return (
													// 点边 = 看这一段要选什么；命中区是下面那条透明宽带
													<g key={edge.key}>
														{/* 选中的边先铺一层画布底色描边再上主色：点阵透不过来，
														    路径在缩放到 0.7 时也还认得出来 */}
														{selected ? (
															<path
																className="text-card"
																d={edge.path}
																fill="none"
																pointerEvents="none"
																stroke="currentColor"
																strokeWidth={6}
															/>
														) : null}
														<path
															className={cn(
																"transition-[opacity,color] duration-200",
																selected
																	? EDGE_SELECTED
																	: hovered
																		? EDGE_HOVER
																		: EDGE_IDLE,
																dimmed ? "opacity-25" : "opacity-100",
															)}
															d={edge.path}
															data-edge-key={edge.key}
															fill="none"
															markerEnd={`url(#${selected ? activeMarkerId : markerId})`}
															pointerEvents="none"
															stroke="currentColor"
															strokeWidth={selected ? 2 : hovered ? 1.75 : 1.25}
														/>
														<path
															className="cursor-pointer"
															d={edge.path}
															fill="none"
															onClick={() => selectEdge(edge)}
															onMouseEnter={() => setHoverEdge(edge.key)}
															onMouseLeave={() => setHoverEdge(null)}
															stroke="transparent"
															strokeWidth={14}
														/>
													</g>
												);
											})}
										</svg>
										{graph.edges.map((edge) => {
											const dimmed =
												highlight !== null && !highlight.edges.has(edge.key);
											const hovered = highlight?.edges.has(edge.key) ?? false;
											const selected = activeEdge?.key === edge.key;
											return (
												// 层级图里「当前节点」的写法：普通=卡底+发丝边，选中=primary 实底
												// + 反白 + 3px 柔光环。选中态因此是整张图上唯一的实心块。
												<button
													className={cn(
														"absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 font-medium text-[11px] tabular-nums transition-[color,background-color,border-color,box-shadow,opacity] duration-150",
														selected
															? "z-30 border-primary/40 bg-primary font-medium text-primary-foreground shadow-md ring-[3px] ring-primary/20"
															: hovered
																? "z-20 border-primary/50 bg-card text-foreground shadow-sm"
																: "z-10 border-border/80 bg-card text-muted-foreground hover:border-primary/50 hover:bg-card hover:text-foreground",
														dimmed ? "opacity-35" : "opacity-100",
													)}
													data-edge-label={edge.key}
													data-edge-selected={selected || undefined}
													key={`label-${edge.key}`}
													onClick={() => selectEdge(edge)}
													onMouseEnter={() => setHoverEdge(edge.key)}
													onMouseLeave={() => setHoverEdge(null)}
													style={{ left: edge.labelX, top: edge.labelY }}
													type="button"
												>
													<span className="flex items-center gap-1">
														<List
															aria-hidden
															className={cn(
																"size-3 shrink-0",
																selected
																	? "text-primary-foreground/80"
																	: "text-muted-foreground",
															)}
														/>
														{edgeOptionLabel(edge.chunk.optionCount)}
													</span>
												</button>
											);
										})}
										{graph.nodes.map((node) => {
											const tone =
												node.node.node_type === "ending"
													? ENDING_TONE[node.ending?.ending_type ?? "other"]
													: NODE_TYPE_TONE[node.node.node_type];
											const hovered = highlight?.nodes.has(node.id) ?? false;
											const dimmed = highlight !== null && !hovered;
											// 选中边的两头挂环：读图时先看到「这一段从哪到哪」
											const selected =
												activeEdge !== null &&
												(node.id === activeEdge.from.id ||
													node.id === activeEdge.to.id);
											// 形状统一成层级图的「站点卡」：同高同宽、圆角一致、文字居中截断；
											// 只有起点是药丸（终结感的两个端点才换形状）
											const radius =
												node.node.node_type === "entry" ||
												node.node.node_type === "ending"
													? "rounded-full"
													: "rounded-lg";
											const isMuted =
												node.node.node_type === "collect" ||
												node.node.node_type === "open";
											return (
												<button
													className={cn(
														"absolute flex items-center justify-center border px-3 text-left transition-[opacity,box-shadow,border-color,background-color] duration-150",
														radius,
														"focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
														tone,
														// 层级图里除「当前」以外都不投影：框一多阴影会叠成一条黑带。
														// 「当前」在这张图上是选中那条边的标签，节点只加一环 + 主色边，
														// 否则一条边会连出三块实心主色，反而看不清读的是哪一段
														selected
															? cn(
																	"z-20 border-primary/40 shadow-sm",
																	SELECTED_RING,
																)
															: hovered
																? cn("z-20 shadow-sm", HOVER_RING)
																: "text-foreground",
														hovered
															? "border-primary/50"
															: "hover:border-primary/50",
														isMuted && !selected
															? "text-muted-foreground"
															: null,
														dimmed ? "opacity-40" : "opacity-100",
													)}
													data-node-id={node.id}
													data-node-type={node.node.node_type}
													key={node.id}
													title={node.label.primary}
													onClick={() => selectNode(node)}
													onMouseEnter={() => setHoverNode(node.id)}
													onMouseLeave={() => setHoverNode(null)}
													style={{
														left: node.x,
														top: node.y,
														width: NODE_WIDTH,
														height: NODE_HEIGHT,
													}}
													type="button"
												>
													<span className="flex min-w-0 items-center gap-1.5">
														<NodeIcon node={node.node} />
														<span className="truncate font-medium text-xs">
															{node.label.primary}
														</span>
													</span>
												</button>
											);
										})}
									</div>
								</div>
							</div>

							{/* 左下角提示 + 右下角工具条：都是层级图同款的「玻璃药丸」。
							    用户要求全屏按钮放在操作按钮里，所以它是这排按钮的一员。
							    data-overlay 让画布的拖拽不要从工具条上起手（否则 setPointerCapture
							    会把后续 click 吃掉，按钮点不动）。 */}
							{/* 窄屏画布比工具条宽不了多少，提示条会压到工具条上，只在 ≥sm 显示 */}
							<div className="pointer-events-none absolute bottom-2 left-3 z-20 hidden items-center gap-1.5 rounded-full border border-border/60 bg-popover/85 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur sm:flex">
								{coarse
									? "单指拖动平移 · 双指捏合缩放 · 点「N 个选项」看这一段"
									: "拖拽平移 · 滚轮缩放 · 点「N 个选项」看这一段"}
							</div>
							<div
								className="absolute right-2 bottom-2 z-20 flex items-center gap-0.5 rounded-full border border-border/60 bg-popover/85 p-0.5 shadow-sm backdrop-blur"
								data-overlay
							>
								{[
									{
										icon: Minus,
										label: "缩小",
										onClick: () => zoomBy(1 / 1.2),
									},
									{ icon: Plus, label: "放大", onClick: () => zoomBy(1.2) },
								].map(({ icon: Icon, label, onClick }) => (
									<button
										aria-label={label}
										className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										key={label}
										onClick={onClick}
										title={label}
										type="button"
									>
										<Icon className="size-3.5" />
									</button>
								))}
								{/* 读数由 applyView 直接写 textContent：缩放时不需要重渲染 */}
								<span
									className="w-9 text-center text-[11px] text-muted-foreground tabular-nums"
									ref={pctRef}
								>
									100%
								</span>
								<span className="mx-0.5 h-4 w-px bg-border" />
								{[
									{ icon: Maximize2, label: "适应画布", onClick: fitToView },
									{
										icon: RotateCcw,
										label: "重置视图",
										onClick: resetView,
									},
									...(onToggleFullscreen
										? [
												{
													icon: fullscreen ? Shrink : Expand,
													label: fullscreen ? "退出全屏" : "全屏",
													onClick: onToggleFullscreen,
												},
											]
										: []),
								].map(({ icon: Icon, label, onClick }) => (
									<button
										aria-label={label}
										className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										key={label}
										onClick={onClick}
										title={label}
										type="button"
									>
										<Icon className="size-3.5" />
									</button>
								))}
							</div>
						</div>
					</div>

					{/* 桌面端：画布在左、选项在右（用户要求「将选项放到右边」）。
					    用 DOM 顺序而不是 flex-row-reverse：读屏/键盘 tab 顺序就是
					    「先看图、再看这一段要选什么」 */}
					<aside
						className="hidden w-[340px] shrink-0 flex-col border-border/70 border-l lg:flex xl:w-[400px]"
						data-graph-options-aside
					>
						{activeChunk ? (
							<GraphOptionsPanel
								chart={chart}
								chunk={activeChunk}
								lang={lang}
								onOpenSegment={onOpenSegment}
							/>
						) : null}
					</aside>

					{/* 窄屏内联：面板叠在画布下方，点边就地更新，不用再开弹层。
					    全屏时没有这块空间，改走下面的抽屉 */}
					{fullscreen ? null : (
						<aside
							className="flex max-h-[42%] min-h-32 shrink-0 flex-col border-border/70 border-t lg:hidden"
							data-graph-options-inline
						>
							{activeChunk ? (
								<GraphOptionsPanel
									chart={chart}
									chunk={activeChunk}
									lang={lang}
									onOpenSegment={onOpenSegment}
								/>
							) : null}
						</aside>
					)}
				</div>
				<NodeLegend />
			</div>

			{/* 全屏 + 窄屏：Modal 里再开一个 Modal（底部抽屉）显示选项。
			    用 Drawer 而不是再包一层 Dialog：自带下滑关闭、Android 返回手势
			    与真实 grab bar；嵌套在父 Modal 里时 Base UI 会自动把 Escape /
			    外部点击的关闭目标留给这一层。 */}
			{fullscreen && isNarrow && activeChunk ? (
				<Drawer onOpenChange={setOptionsOpen} open={optionsOpen}>
					<DrawerContent backdropForceRender>
						<DrawerTitle className="sr-only">选项步骤</DrawerTitle>
						<div className="min-h-0 flex-1">
							<GraphOptionsPanel
								chart={chart}
								chunk={activeChunk}
								className="pt-1"
								lang={lang}
								onAfterOpenSegment={() => setOptionsOpen(false)}
								onOpenSegment={onOpenSegment}
							/>
						</div>
					</DrawerContent>
				</Drawer>
			) : null}
		</>
	);
}
