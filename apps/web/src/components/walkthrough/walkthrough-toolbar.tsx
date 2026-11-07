import { Select as SelectPrimitive } from "@base-ui/react/select";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectValue,
} from "@web/components/ui/select";
import { cn } from "@web/lib/utils";
import { ChevronDown, Languages } from "lucide-react";
import {
	isWalkthroughLang,
	WALKTHROUGH_LANG_LABELS,
	WALKTHROUGH_LANGS,
	WALKTHROUGH_VIEW_LABELS,
	WALKTHROUGH_VIEWS,
	type WalkthroughLang,
	type WalkthroughView,
} from "./types";

/** 分段控件（视图切换用）：整页只有一种「选项卡」的视觉语言 */
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

/** 语言三档的下拉选项：顺序 = 界面顺序（中文 → 原文 → 双语） */
const LANG_ITEMS = WALKTHROUGH_LANGS.map((value) => ({
	value,
	label: WALKTHROUGH_LANG_LABELS[value],
}));

/**
 * 视图 / 语言切换（同一行，左视图、右语言）。
 *
 * 视图不再用大卡片：一屏里「角色路线卡 + 视图卡 + 段落目录」三排大块太吵，
 * 而且视图切换只是三个互斥选项，用与语言同一套药丸选项卡更轻、也更省高度。
 *
 * 两个选择都写进地址栏（view / lang），所以刷新与分享能还原同一个视图；
 * 切换本身是纯客户端状态，不触发 furin 页面取数（详见 use-shallow-search）。
 */
export function WalkthroughToolbar({
	view,
	lang,
	onViewChange,
	onLangChange,
}: {
	view: WalkthroughView;
	lang: WalkthroughLang;
	onViewChange: (view: WalkthroughView) => void;
	onLangChange: (lang: WalkthroughLang) => void;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<div className="flex flex-wrap items-center gap-2">
				{/* 成组的分段按钮用 fieldset + 隐藏 legend：读屏会先报「视图切换」，
				    再逐个报「按角色，已按下」——纯 div + role=group 在部分读屏里会被略过 */}
				<fieldset className={cn(groupClass, "m-0 min-w-0 border-0")}>
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
			</div>
			<WalkthroughLangSwitch lang={lang} onLangChange={onLangChange} />
		</div>
	);
}

/**
 * 语言三档切换：下拉 Select（中文 / 原文 / 双语）。
 *
 * 之前的触发器是 ui/select 给 shadcn 表单用的默认外观（带 1px 边框、
 * 圆角 10、hover 变底色），放在这排工具条里跟左边的「视图切换」药丸组
 * 不是一套东西（那组是 h-8 / rounded-xl / bg-muted/40 / ring-1）。
 *
 * 这里改用 Base UI 的 Trigger 原语自己画（避开 ui/select 的默认尺寸类）：尺寸、圆角、底色、描边环全部对齐
 * 视图切换那组，只是多一个下拉箭头 —— 整排控件因此是同一种材质。
 */
export function WalkthroughLangSwitch({
	lang,
	onLangChange,
}: {
	lang: WalkthroughLang;
	onLangChange: (lang: WalkthroughLang) => void;
}) {
	return (
		<Select
			items={LANG_ITEMS}
			onValueChange={(next) => {
				if (isWalkthroughLang(next)) onLangChange(next);
			}}
			value={lang}
		>
			<SelectPrimitive.Trigger
				aria-label="语言切换"
				className="inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-xl bg-muted/40 px-2.5 font-medium text-foreground text-sm ring-1 ring-border/60 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60"
			>
				<Languages
					aria-hidden
					className="size-3.5 shrink-0 text-muted-foreground"
				/>
				<SelectValue />
				<SelectPrimitive.Icon
					render={
						<ChevronDown
							aria-hidden
							className="size-3.5 shrink-0 text-muted-foreground"
						/>
					}
				/>
			</SelectPrimitive.Trigger>
			<SelectContent alignItemWithTrigger={false} sideOffset={6}>
				{LANG_ITEMS.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
