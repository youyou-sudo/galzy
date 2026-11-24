import { useQuery } from "@tanstack/react-query";
import { NavigationMenuItem } from "@web/components/ui/navigation-menu";
import {
	type PublicAdvert,
	pickNavAdvert,
	TOP_NAV_SLOT_KEY,
} from "@web/lib/adverts";
import { cn } from "@web/lib/utils";
import { adSlotQueryOptions, trackAdvert } from "@web/server/adverts";
import { ChevronRight, Megaphone } from "lucide-react";
import { desktopFlatLinkClass, mobileNavRowClass } from "../header/nav-styles";

/**
 * 顶栏推广入口（广告位 key = `header_nav`）。
 *
 * 它就是一个普通导航标签：与「论坛」「标签」同高、同圆角、同 hover 底色，
 * 视觉上不另做一套样式——差别只在语义上：
 * - 链接带 `rel="sponsored nofollow noreferrer"` 与 `data-ad-slot`：
 *   搜索引擎不会把这根推广外链当站内导航抓取，也不传递权重；
 * - 文案与链接由后台广告素材下发，停用后整格自动消失，不用发版。
 *
 * 数据由根布局 loader 预取并 seed 进 query 缓存（见 pages/root.tsx），
 * 所以 SSR 首帧就带着这个入口，不会「先少一格、JS 跑完再补上」。
 */

/** 当前在投的推广素材（广告位/素材停用或没配置时为 null）。 */
export function useNavAdvert(): PublicAdvert | null {
	const { data } = useQuery(adSlotQueryOptions(TOP_NAV_SLOT_KEY));
	return pickNavAdvert(data ?? null);
}

function trackClick(advert: PublicAdvert) {
	void trackAdvert({ data: { id: advert.id, type: "click" } }).catch(() => {});
}

/**
 * 推广角标「广」：贴在文案右上角，说明这一格是推广而非站内导航。
 *
 * 纯装饰：`aria-hidden` 让它不进入可读名（否则读屏与测试里会读成「AI女友 广」），
 * 语义已经由 `rel="sponsored nofollow"` 与 `data-ad-slot` 表达。
 * 不透明度不写在这里：整格已经压到 70%，角标随之一起变淡，再叠一层会淡到看不见。
 */
function AdBadge() {
	return (
		<span
			aria-hidden="true"
			className="absolute -top-1 -right-1.5 text-[10px] leading-none font-medium pointer-events-none select-none"
		>
			广
		</span>
	);
}

/** 推广外链的公共属性：语义标记 + 点击统计，桌面与移动共用。 */
function adLinkProps(advert: PublicAdvert) {
	return {
		href: advert.href,
		target: "_blank",
		// sponsored/nofollow：明确告诉搜索引擎这是推广内容，不抓取、不计权重
		rel: "sponsored nofollow noopener noreferrer",
		"data-ad-slot": TOP_NAV_SLOT_KEY,
		"data-umami-event": "推广位点击",
		"data-umami-event-name": advert.name,
	} as const;
}

/**
 * 桌面端主导航里的推广条目（复用扁平链接排版，与其它标签完全一致）。
 *
 * 整格连 <li> 一起托管：没有在投素材时连列表项都不渲染，
 * 否则顶栏末尾会留下一个占位的空 <li>（gap 仍会撑出一截空白）。
 *
 * 整格（文案 + 角标）固定 70% 不透明度：推广入口在视觉上比站内导航轻一档，
 * 与顶部横幅位的 opacity 处理同源；排版、hover、可读名仍与其它标签一致。
 */
export function DesktopNavAdItem() {
	const advert = useNavAdvert();
	// 文字位没有图片，name 即按钮文案
	if (!advert) return null;
	return (
		<NavigationMenuItem>
			<a
				{...adLinkProps(advert)}
				className={cn(desktopFlatLinkClass, "relative opacity-70")}
				onClick={() => trackClick(advert)}
			>
				<span className="relative inline-block">
					{advert.name}
					<AdBadge />
				</span>
			</a>
		</NavigationMenuItem>
	);
}

/**
 * 移动全屏菜单里的推广行：与其它 NavRow 结构一致（图标方块 + 文案 + 箭头），
 * 图标用 Megaphone 表明这是推广，文案仍然来自后台。
 *
 * 角标与不透明度与桌面端同源：文案右上角贴「广」，整行压到 70%，
 * 让推广入口在一屏导航里比站内入口轻一档，不用靠排版差异区分。
 */
export function MobileNavAdRow({
	index,
	open,
	onSelect,
}: {
	/** 全局序号（跨分组连续），用于错峰入场延迟 */
	index: number;
	open: boolean;
	onSelect: () => void;
}) {
	const advert = useNavAdvert();
	if (!advert) return null;
	// 关闭后移除延迟，下次打开时关键帧从干净的起点重播
	const style = open ? { animationDelay: `${80 + index * 45}ms` } : undefined;

	return (
		<a
			{...adLinkProps(advert)}
			className={cn(mobileNavRowClass, "opacity-70")}
			style={style}
			onClick={() => {
				trackClick(advert);
				onSelect();
			}}
		>
			<span
				className={cn(
					"flex shrink-0 justify-center items-center size-8 rounded-lg",
					"text-muted-foreground bg-muted/70 transition-colors duration-200",
					"group-hover/row:text-foreground group-hover/row:bg-background",
				)}
			>
				<Megaphone className="size-4" />
			</span>
			<span className="flex flex-col flex-1 min-w-0">
				{/* self-start：不吸满整行宽度，角标才会贴在文案右上角而不是箭头旁边；
				    truncate 放在内层，overflow-hidden 才不会把角标一起裁掉 */}
				<span className="relative inline-block self-start max-w-full text-sm leading-tight font-medium">
					<span className="block truncate">{advert.name}</span>
					<AdBadge />
				</span>
			</span>
			<ChevronRight
				className={cn(
					"shrink-0 size-4 text-muted-foreground/60",
					"transition-transform duration-200",
					"group-hover/row:translate-x-0.5",
				)}
			/>
		</a>
	);
}
