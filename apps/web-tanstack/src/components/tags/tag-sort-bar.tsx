import { useNavigate } from "@tanstack/react-router";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import { formatCount } from "@web/lib";
import type { TagOrderKey, TagSortKey } from "@web/server/tags";
import { ListFilter } from "lucide-react";

/**
 * 排序筛选的「依据」维度。顺序即下拉里的顺序；标签库这边「热度」同时给出
 * 三种口径：累计收录游戏数（count）、累计浏览量（views），以及按时间窗切分
 * 的本周 / 本月热门（hotWeek / hotMonth，数据源为窗口内标签浏览量）。
 */
export const TAG_SORT_ITEMS: ReadonlyArray<{ key: TagSortKey; label: string }> =
	[
		{ key: "hotWeek", label: "本周热门" },
		{ key: "hotMonth", label: "本月热门" },
		{ key: "views", label: "总浏览量" },
		{ key: "count", label: "收录数量" },
		{ key: "name", label: "名称" },
	];

/**
 * 「正序 / 倒序」指的是**榜单自然顺序**及其反向，而不是「从小到大」：
 * 热榜的自然顺序是第一名在前（数值从大到小），名称的自然顺序是 A→Z。
 * 因此正序对应的底层方向随依据而变 —— 数值指标用 desc、名称用 asc。
 *
 * URL / API 里的 order 始终是物理方向（desc 降序、asc 升序），映射只发生在
 * 这一层，接口本身不需要知道「正序」这个概念。
 */
const naturalOrder = (sort: TagSortKey): TagOrderKey =>
	sort === "name" ? "asc" : "desc";

const reverseOrder = (order: TagOrderKey): TagOrderKey =>
	order === "asc" ? "desc" : "asc";

/** 换依据时把「正序 / 倒序」的语义平移过去，标签文字不跟着反转 */
const remapOrder = (
	from: TagSortKey,
	order: TagOrderKey,
	to: TagSortKey,
): TagOrderKey => {
	if (from === to) return order;
	const wasNatural = order === naturalOrder(from);
	return wasNatural ? naturalOrder(to) : reverseOrder(naturalOrder(to));
};

/**
 * Select.Root 的 items：触发按钮上的文字由它解析。
 *
 * 不传的话 base-ui 只能从弹层里已注册的 Item 取标签，而弹层走 Portal、
 * SSR 时段并不渲染 —— 首屏会先渲染出原始值 "views"，hydration 后再跳成
 * 「总浏览量」，既难看又会报水合不一致。
 */
const SORT_SELECT_ITEMS: ReadonlyArray<{ label: string; value: TagSortKey }> =
	TAG_SORT_ITEMS.map(({ key, label }) => ({ label, value: key }));

type TagMetric = {
	name: string;
	vnCount: number;
	views: number;
	viewsWeek: number;
	viewsMonth: number;
};

/**
 * 行内 tooltip：所有口径都给全 —— 列表尾部固定显示收录数，浏览量只在这里出现，
 * 排序切到「总浏览量」/「本周热门」/「本月热门」时用户仍然能对上号。
 * 三个浏览量都走 formatCount：上万之后原样写会撑长气泡（88.1K 比 88126 好读），
 * 收录数不折算 —— 它是「多少部作品」，和列表尾部那一列必须逐字对齐。
 */
export const tagMetricsTitle = (tag: TagMetric) =>
	`${tag.name}（收录 ${tag.vnCount} · 总浏览 ${formatCount(tag.views)} · 周 ${formatCount(tag.viewsWeek)} · 月 ${formatCount(tag.viewsMonth)}）`;

type TagSortBarProps = { value: TagSortKey; order: TagOrderKey } & (
	| { scope: "hub" }
	| { scope: "category"; categoryKey: string }
);

/**
 * 标签排序筛选条：两个下拉 —— 「依据」（收录数 / 总浏览量 / 本周热门 /
 * 本月热门 / 名称）与「方向」（正序 / 倒序）。标签库（一次切换对所有分类块
 * 生效）与分类页共用同一套 UI。
 *
 * 排序状态进 URL（sort + order）：可分享、可回退，SSR 直出目标顺序，路由
 * loader 也能按这个值预取。两个维度相互独立 —— 换依据时「正序 / 倒序」的
 * 选择保持不变（底层方向按上面的 naturalOrder 平移），换方向不影响依据。
 */
export function TagSortBar(props: TagSortBarProps) {
	const navigate = useNavigate();
	// 默认（总浏览量 + 正序）就是热榜自然顺序：第一名在前
	const orderItems = [
		{ value: naturalOrder(props.value), label: "正序" },
		{ value: reverseOrder(naturalOrder(props.value)), label: "倒序" },
	];
	const orderSelectItems = orderItems.map(({ value, label }) => ({
		label,
		value,
	}));

	const go = (next: { sort?: TagSortKey; order?: TagOrderKey }) => {
		const search = {
			sort: next.sort ?? props.value,
			order:
				next.order ??
				(next.sort
					? remapOrder(props.value, props.order, next.sort)
					: props.order),
		};
		if (props.scope === "hub") {
			navigate({
				to: "/tags",
				search,
				replace: true,
				resetScroll: false,
				// 只是同页参数变化，不需要整页 View Transition 过渡
				viewTransition: false,
			});
			return;
		}
		navigate({
			to: "/tags/category/$categoryKey",
			params: { categoryKey: props.categoryKey },
			search,
			replace: true,
			resetScroll: false,
			viewTransition: false,
		});
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			<ListFilter className="size-4 shrink-0 text-muted-foreground" />
			<span className="shrink-0 text-sm text-muted-foreground">排序：</span>
			<Select
				value={props.value}
				onValueChange={(next) => {
					if (next && next !== props.value) go({ sort: next });
				}}
				items={SORT_SELECT_ITEMS}
			>
				<SelectTrigger size="sm" className="w-28" aria-label="排序依据">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{TAG_SORT_ITEMS.map((item) => (
						<SelectItem key={item.key} value={item.key}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				value={props.order}
				onValueChange={(next) => {
					if (next && next !== props.order) go({ order: next });
				}}
				items={orderSelectItems}
			>
				<SelectTrigger size="sm" className="w-20" aria-label="排序方向">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{orderItems.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
