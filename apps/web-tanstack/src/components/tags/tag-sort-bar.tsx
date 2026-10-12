import { useNavigate } from "@tanstack/react-router";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import type { TagSortKey } from "@web/server/tags";
import { ListFilter } from "lucide-react";

/**
 * 排序筛选项。顺序即下拉里的顺序；文案与游戏列表的筛选条（发布时间 /
 * 下载量 / 浏览量）对齐，标签库这边「热度」同时给出两种口径：
 * 站内收录游戏数（count）与站内浏览量（views）。
 */
export const TAG_SORT_ITEMS: ReadonlyArray<{ key: TagSortKey; label: string }> =
	[
		{ key: "count", label: "收录数" },
		{ key: "views", label: "浏览量" },
		{ key: "nameAsc", label: "名称升序" },
		{ key: "nameDesc", label: "名称降序" },
	];

/**
 * Select.Root 的 items：触发按钮上的文字由它解析。
 *
 * 不传的话 base-ui 只能从弹层里已注册的 Item 取标签，而弹层走 Portal、
 * SSR 时段并不渲染 —— 首屏会先渲染出原始值 "views"，hydration 后再跳成
 * 「浏览量」，既难看又会报水合不一致。
 */
const SORT_SELECT_ITEMS: ReadonlyArray<{ label: string; value: TagSortKey }> =
	TAG_SORT_ITEMS.map(({ key, label }) => ({ label, value: key }));

type TagMetric = { name: string; vnCount: number; views: number };

/**
 * 行内 tooltip：两个口径都给全 —— 列表尾部固定显示收录数，浏览量只在这里出现，
 * 排序切到「浏览量」时用户仍然能对上号。
 */
export const tagMetricsTitle = (tag: TagMetric) =>
	`${tag.name}（收录 ${tag.vnCount} · 浏览量 ${tag.views}）`;

type TagSortBarProps = { value: TagSortKey } & (
	| { scope: "hub" }
	| { scope: "category"; categoryKey: string }
);

/**
 * 标签排序筛选条：标签库（一次切换对所有分类块生效）与分类页共用同一套 UI。
 *
 * 排序状态进 URL：可分享、可回退，SSR 直出目标顺序，路由 loader 也能按这个值预取。
 */
export function TagSortBar(props: TagSortBarProps) {
	const navigate = useNavigate();

	const handleValueChange = (next: TagSortKey | null) => {
		if (!next || next === props.value) return;
		if (props.scope === "hub") {
			navigate({
				to: "/tags",
				search: { sort: next },
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
			search: { sort: next },
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
				onValueChange={(next) => handleValueChange(next)}
				items={SORT_SELECT_ITEMS}
			>
				<SelectTrigger size="sm" className="w-28" aria-label="排序方式">
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
		</div>
	);
}
