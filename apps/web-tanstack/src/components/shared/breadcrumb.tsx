import { BreadcrumbLink as BaseBreadcrumbLink } from "@web/components/ui/breadcrumb";
import * as React from "react";

export {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@web/components/ui/breadcrumb";

type Preload = false | "intent" | "viewport" | "render";

/** 省流模式（navigator.connection.saveData）下不预取；SSR 阶段 navigator 不存在，按不省流处理。
 *  模块级求值：避免渲染期读取全局变量（React Compiler / 纯渲染约束）。 */
const SAVE_DATA_ENABLED =
	typeof navigator !== "undefined" &&
	(navigator as Navigator & { connection?: { saveData?: boolean } }).connection
		?.saveData === true;

/**
 * 面包屑链路：与 ui/breadcrumb 的 BreadcrumbLink 完全同构，唯一区别是默认开启
 * 路由预取（preload="viewport"）。面包屑位于页面顶部、始终处于视口内，挂载即预取
 * 祖先路由的 JS chunk + loader 数据（配合 router 的 defaultPreloadStaleTime=30s），
 * 点击「首页 / 全部游戏 / 论坛 …」返回上级时直接命中路由缓存，秒开。
 *
 * - 调用方显式传入 preload（如 render={<Link preload="intent" />}）时以调用方为准；
 * - 传入的 render 不是元素（函数式 render / 未传）时原样透传，不做干预。
 *
 * 页面统一从 @web/components/shared/breadcrumb 导入，预取策略只在这里改一处。
 */
export function BreadcrumbLink({
	render,
	...props
}: React.ComponentProps<typeof BaseBreadcrumbLink>) {
	const prefetchedRender = React.useMemo(() => {
		if (!React.isValidElement(render)) return render;
		const element = render as React.ReactElement<{ preload?: Preload }>;
		// 原生标签（<a> 等）没有 preload 语义，不动
		if (typeof element.type === "string") return element;
		// 显式声明过 preload 的链接不覆盖
		if (element.props.preload !== undefined) return element;
		if (SAVE_DATA_ENABLED) return element;
		return React.cloneElement(element, { preload: "viewport" as const });
	}, [render]);

	return <BaseBreadcrumbLink render={prefetchedRender} {...props} />;
}
