import { cn } from "@web/lib/utils";
import { useId, useMemo, useState } from "react";
import {
	type ChartNodeId,
	chartNodeId,
	endingTypeLabel,
	nodeLabel,
	segmentAnchorId,
	segmentOptionCount,
	segmentsForCharacter,
} from "./chart-utils";
import type {
	ChartEnding,
	ChartEndingType,
	ChartLang,
	ChartNode,
	ChartSegment,
	ChartText,
	WalkthroughChart,
} from "./types";

export interface GraphViewProps {
	chart: WalkthroughChart;
	/** 双语三档，默认 both（中文主文 + 括注原文） */
	lang?: ChartLang;
	/** 只看某个角色（c1/c2…）；null/undefined 表示全部路线 */
	characterKey?: string | null;
	/** 点节点时回调（壳用它切到「按顺序」并滚到段落）；不传则自己 scrollIntoView */
	onSegmentSelect?: (segmentKey: string) => void;
	/** 节点数兜底，超过就只提示选角色（默认 200） */
	maxNodes?: number;
	className?: string;
}

/*
 * 布局常量（像素）。节点是 HTML 绝对定位、连线是 SVG，两者共用同一套坐标，
 * 所以宽高必须是常量：文字换行交给 truncate，不参与测量 -> 渲染期一次算完，
 * 不会因为测量回流变成 O(n²)。
 */
const NODE_WIDTH = 176;
const NODE_HEIGHT = 56;
const COL_STEP = 248;
const ROW_STEP = 76;
const MARGIN = 16;

/** 结局按类型配色；个人线/后宫/真结局/普通/坏结局/后日谈/其他 */
const ENDING_TONE: Record<ChartEndingType, string> = {
	heroine:
		"border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
	harem:
		"border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200",
	true: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200",
	normal: "border-sky-500/50 bg-sky-500/10 text-sky-800 dark:text-sky-200",
	bad: "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-200",
	after: "border-teal-500/50 bg-teal-500/10 text-teal-800 dark:text-teal-200",
	other: "border-border bg-muted text-foreground",
};

const NODE_TYPE_TONE: Record<
	Exclude<ChartNode["node_type"], "ending">,
	string
> = {
	entry: "border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-200",
	save: "border-indigo-500/50 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200",
	collect: "border-border border-dashed bg-muted text-muted-foreground",
	open: "border-border border-dashed bg-background text-muted-foreground",
};

interface GraphNode {
	id: ChartNodeId;
	node: ChartNode;
	label: ChartText;
	ending: ChartEnding | null;
	layer: number;
	row: number;
	x: number;
	y: number;
}

interface GraphEdge {
	key: string;
	from: ChartNodeId;
	to: ChartNodeId;
	options: number;
	path: string;
	labelX: number;
	labelY: number;
	/** 点这条边要回跳的段落（详情由壳的 onSegmentSelect 决定怎么展示） */
	segment: ChartSegment;
}

/**
 * 分层：Kahn 拓扑排序取「最早可到达的列 +1」= 最长路径分层。
 * 流程图上本该是 DAG，但上游数据里存档回跳可能造出回边/环，
 * 所以剩下的节点统一丢到最后一列，绝不死循环。
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

function edgePath(from: GraphNode, to: GraphNode): string {
	const x1 = from.x + NODE_WIDTH;
	const y1 = from.y + NODE_HEIGHT / 2;
	const x2 = to.x;
	const y2 = to.y + NODE_HEIGHT / 2;
	const dx = x2 > x1 ? (x2 - x1) / 2 : 56;
	return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** 一次算完节点/连线/画布尺寸；调用方用 useMemo 包住，交互只改 hover 状态 */
function buildGraph(
	chart: WalkthroughChart,
	lang: ChartLang,
	characterKey: string | null | undefined,
) {
	const segments = segmentsForCharacter(chart, characterKey);

	// 节点去重：同一 (node_type,key) 在多段里反复出现，只画一个
	const nodesById = new Map<ChartNodeId, ChartNode>();
	const pushNode = (node: ChartNode) => {
		const id = chartNodeId(node);
		if (!nodesById.has(id)) nodesById.set(id, node);
		return id;
	};

	const pairs: Array<[ChartNodeId, ChartNodeId]> = [];
	for (const segment of segments) {
		pairs.push([pushNode(segment.from_node), pushNode(segment.to_node)]);
	}

	const ids = [...nodesById.keys()];
	const layers = assignLayers(ids, pairs);

	// 同列按首次出现顺序上下排布，保证同一份数据每次布局一致
	const rowCursor = new Map<number, number>();
	const nodes: GraphNode[] = ids.map((id) => {
		const node = nodesById.get(id) as ChartNode;
		const layer = layers.get(id) ?? 0;
		const row = rowCursor.get(layer) ?? 0;
		rowCursor.set(layer, row + 1);
		return {
			id,
			node,
			label: nodeLabel(chart, node, lang),
			ending:
				node.node_type === "ending"
					? ((chart.endings ?? []).find((e) => e.key === node.key) ?? null)
					: null,
			layer,
			row,
			x: MARGIN + layer * COL_STEP,
			y: MARGIN + row * ROW_STEP,
		};
	});

	const nodeIndex = new Map(nodes.map((n) => [n.id, n]));
	const edges: GraphEdge[] = segments.map((segment) => {
		const from = nodeIndex.get(chartNodeId(segment.from_node)) as GraphNode;
		const to = nodeIndex.get(chartNodeId(segment.to_node)) as GraphNode;
		return {
			key: segment.key,
			from: from.id,
			to: to.id,
			options: segmentOptionCount(segment),
			path: edgePath(from, to),
			labelX: (from.x + NODE_WIDTH + to.x) / 2,
			labelY: (from.y + to.y) / 2 + NODE_HEIGHT / 2 - 8,
			segment,
		};
	});

	// 点击节点跳到它出发的第一段：预建映射，避免每条节点渲染时再扫一遍 segments
	const firstSegmentFrom = new Map<ChartNodeId, ChartSegment>();
	for (const segment of segments) {
		const fromId = chartNodeId(segment.from_node);
		if (!firstSegmentFrom.has(fromId)) firstSegmentFrom.set(fromId, segment);
	}

	const maxLayer = nodes.reduce((m, n) => Math.max(m, n.layer), 0);
	const maxRow = nodes.reduce((m, n) => Math.max(m, n.row), 0);

	return {
		nodes,
		edges,
		segments,
		firstSegmentFrom,
		width: MARGIN * 2 + maxLayer * COL_STEP + NODE_WIDTH,
		height: MARGIN * 2 + maxRow * ROW_STEP + NODE_HEIGHT,
	};
}

/** 小图例：颜色含义，壳的「符号说明」讲的是源文里的 ★/⇒，这里只讲配色 */
function NodeLegend() {
	const items = ["起点", "存档", "回收 CG / 场景", "结局", "未标注终点"];
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
			{items.map((item) => (
				<span className="flex items-center gap-1" key={item}>
					<span className="size-2 rounded-sm border border-border bg-muted" />
					{item}
				</span>
			))}
		</div>
	);
}

/**
 * 「流程图」视图：自写的轻量分层布局（不用任何外部图库）。
 * 节点 = 段落端点去重，边 = 段落；hover 高亮相邻路径，点击跳到对应段落。
 */
export function GraphView({
	chart,
	lang = "both",
	characterKey = null,
	onSegmentSelect,
	maxNodes = 200,
	className,
}: GraphViewProps) {
	// SVG marker 的 id 是全局的，同页两个 GraphView 会撞车，所以用 useId 加后缀
	const markerId = `wt-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const graph = useMemo(
		() => buildGraph(chart, lang, characterKey),
		[chart, lang, characterKey],
	);
	const [hoverNode, setHoverNode] = useState<ChartNodeId | null>(null);
	const [hoverEdge, setHoverEdge] = useState<string | null>(null);

	// hover 时把与当前对象无关的连线/节点压暗，一眼看出这条路径去哪儿
	const highlight = useMemo(() => {
		if (hoverEdge) {
			const edge = graph.edges.find((e) => e.key === hoverEdge);
			if (!edge) return null;
			return {
				edges: new Set([edge.key]),
				nodes: new Set<ChartNodeId>([edge.from, edge.to]),
			};
		}
		if (hoverNode) {
			const edges = graph.edges.filter(
				(e) => e.from === hoverNode || e.to === hoverNode,
			);
			const nodes = new Set<ChartNodeId>([hoverNode]);
			for (const edge of edges) {
				nodes.add(edge.from);
				nodes.add(edge.to);
			}
			return { edges: new Set(edges.map((e) => e.key)), nodes };
		}
		return null;
	}, [graph, hoverNode, hoverEdge]);

	if (graph.segments.length === 0) {
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

	// 大图兜底：分层布局对上百节点仍会挤成一团，直接把决定权交回给角色筛选
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

	const selectSegment = (segment: ChartSegment) => {
		if (onSegmentSelect) {
			onSegmentSelect(segment.key);
			return;
		}
		// 没给回调时自己滚：壳体里「按顺序」在另一个视图，能滚到就滚，滚不到就算了
		const element = document.getElementById(segmentAnchorId(segment.key));
		element?.scrollIntoView?.({ behavior: "smooth", block: "start" });
	};

	return (
		<div className={cn("space-y-2", className)}>
			{/* 移动端横向滚动；宽度由布局算出，包裹层不撑破页面 */}
			<div className="w-full overflow-x-auto pb-2">
				<div
					className="relative"
					style={{ width: graph.width, height: graph.height }}
				>
					<svg
						aria-hidden
						className="absolute inset-0"
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
								{/* marker 内容不继承引用者颜色，这里固定成弱化的边框色 */}
								<path
									className="text-muted-foreground"
									d="M 0 0 L 10 5 L 0 10 z"
									fill="currentColor"
								/>
							</marker>
						</defs>
						{graph.edges.map((edge) => {
							const dimmed =
								highlight !== null && !highlight.edges.has(edge.key);
							const active = highlight?.edges.has(edge.key) ?? false;
							return (
								// 点边 = 看这一段要选什么；命中区是下面那条透明宽带
								<g
									className="cursor-pointer"
									key={edge.key}
									onClick={() => selectSegment(edge.segment)}
								>
									<path
										className={cn(
											"transition-opacity",
											active ? "text-primary" : "text-border",
											dimmed ? "opacity-25" : "opacity-100",
										)}
										d={edge.path}
										data-edge-key={edge.key}
										fill="none"
										markerEnd={`url(#${markerId})`}
										pointerEvents="none"
										stroke="currentColor"
										strokeWidth={active ? 2.5 : 1.5}
									/>
									{/* 1.5px 的线几乎点不中，单独铺一条透明宽带做 hover 命中区 */}
									<path
										d={edge.path}
										fill="none"
										onMouseEnter={() => setHoverEdge(edge.key)}
										onMouseLeave={() => setHoverEdge(null)}
										stroke="transparent"
										strokeWidth={12}
									/>
								</g>
							);
						})}
					</svg>
					{graph.edges.map((edge) => {
						const dimmed = highlight !== null && !highlight.edges.has(edge.key);
						return (
							<span
								className={cn(
									"pointer-events-none absolute -translate-x-1/2 rounded bg-background/90 px-1 text-[10px] text-muted-foreground tabular-nums",
									dimmed ? "opacity-25" : "opacity-100",
								)}
								key={`label-${edge.key}`}
								style={{ left: edge.labelX, top: edge.labelY }}
							>
								{edge.options} 个选项
							</span>
						);
					})}
					{graph.nodes.map((node) => {
						const tone =
							node.node.node_type === "ending"
								? ENDING_TONE[node.ending?.ending_type ?? "other"]
								: NODE_TYPE_TONE[node.node.node_type];
						const dimmed = highlight !== null && !highlight.nodes.has(node.id);
						const segment = graph.firstSegmentFrom.get(node.id);
						return (
							<button
								className={cn(
									"absolute flex flex-col justify-center gap-0.5 rounded-lg border px-2.5 text-left transition-opacity",
									"hover:z-10 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary",
									tone,
									dimmed ? "opacity-40" : "opacity-100",
								)}
								data-node-id={node.id}
								data-node-type={node.node.node_type}
								key={node.id}
								onClick={() => {
									if (segment) selectSegment(segment);
								}}
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
								<span className="truncate font-medium text-xs">
									{node.label.primary}
								</span>
								<span className="truncate text-[10px] opacity-70">
									{node.label.secondary ??
										(node.ending
											? endingTypeLabel(node.ending.ending_type)
											: node.node.node_type === "entry"
												? "起点"
												: "")}
								</span>
							</button>
						);
					})}
				</div>
			</div>
			<NodeLegend />
		</div>
	);
}
