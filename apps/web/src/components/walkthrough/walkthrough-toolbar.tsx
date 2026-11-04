import { cn } from "@web/lib/utils";
import {
	WALKTHROUGH_LANG_LABELS,
	WALKTHROUGH_LANGS,
	WALKTHROUGH_VIEW_LABELS,
	WALKTHROUGH_VIEWS,
	type WalkthroughLang,
	type WalkthroughView,
} from "./types";

/** 与页签栏同一套药丸底：整页只有一种「分段控件」的视觉语言 */
const groupClass =
	"inline-flex gap-0.5 p-0.5 bg-muted/40 rounded-xl ring-1 ring-border/60";

const itemClass = (active: boolean) =>
	cn(
		"px-2.5 h-8 text-sm font-medium rounded-lg transition-colors duration-200 sm:px-3",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
		active
			? "text-foreground bg-muted/60"
			: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
	);

/**
 * 视图 / 语言切换。
 *
 * 两个选择都写进地址栏（view / lang），所以刷新与分享能还原同一个视图；
 * 切换本身是纯客户端状态，不触发 furin 页面取数（详见 use-shallow-search）。
 */
export function WalkthroughToolbar({
	view,
	lang,
	onViewChange,
	onLangChange,
	onShowAll,
}: {
	view: WalkthroughView;
	lang: WalkthroughLang;
	onViewChange: (view: WalkthroughView) => void;
	onLangChange: (lang: WalkthroughLang) => void;
	/** 传了才显示「显示全部路线」：只在已选中某个角色时有意义 */
	onShowAll?: () => void;
}) {
	return (
		<div className="flex flex-wrap gap-2 justify-between items-center">
			<div className="flex flex-wrap gap-2 items-center">
				{/* 成组的分段按钮用 fieldset + 隐藏 legend：读屏会先报「视图切换」，
				    再逐个报「按角色，已按下」——纯 div + role=group 在部分读屏里会被略过 */}
				<fieldset className={cn(groupClass, "border-0 m-0 min-w-0")}>
					<legend className="sr-only">视图切换</legend>
					{WALKTHROUGH_VIEWS.map((item) => (
						<button
							aria-pressed={view === item}
							className={itemClass(view === item)}
							key={item}
							onClick={() => onViewChange(item)}
							type="button"
						>
							{WALKTHROUGH_VIEW_LABELS[item]}
						</button>
					))}
				</fieldset>
				{onShowAll ? (
					<button
						className={cn(
							"px-2.5 h-8 text-sm font-medium rounded-lg ring-1 ring-border/60 transition-colors duration-200 sm:px-3",
							"text-muted-foreground hover:text-foreground hover:bg-muted/40",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
						)}
						onClick={onShowAll}
						type="button"
					>
						显示全部路线
					</button>
				) : null}
			</div>
			<fieldset className={cn(groupClass, "border-0 m-0 min-w-0")}>
				<legend className="sr-only">语言切换</legend>
				{WALKTHROUGH_LANGS.map((item) => (
					<button
						aria-pressed={lang === item}
						className={itemClass(lang === item)}
						key={item}
						onClick={() => onLangChange(item)}
						type="button"
					>
						{WALKTHROUGH_LANG_LABELS[item]}
					</button>
				))}
			</fieldset>
		</div>
	);
}
