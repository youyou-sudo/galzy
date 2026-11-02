"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 页内状态能落到 URL 上的值类型（与 furin / TypeBox 的 query 编码一致）。 */
export type ShallowSearchValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| readonly (string | number)[];

export type ShallowSearch = Record<string, ShallowSearchValue>;

type Patch<T> = Partial<T> | ((previous: T) => Partial<T>);

function sameValue(a: ShallowSearchValue, b: ShallowSearchValue): boolean {
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		return a.every((item, index) => String(item) === String(b[index]));
	}
	if (a === undefined || a === null || b === undefined || b === null) {
		return (a ?? null) === (b ?? null);
	}
	return String(a) === String(b);
}

/** 只改地址栏，不触发 furin 的页面导航。 */
function writeShallowUrl<T extends ShallowSearch>(
	search: T,
	defaults: Partial<T> | undefined,
): void {
	if (typeof window === "undefined") return;
	const url = new URL(window.location.href);
	for (const [key, raw] of Object.entries(search)) {
		const isDefault =
			defaults !== undefined && key in defaults
				? sameValue(raw, defaults[key as keyof T])
				: false;
		const isEmpty =
			raw === undefined ||
			raw === null ||
			raw === "" ||
			(Array.isArray(raw) && raw.length === 0);
		url.searchParams.delete(key);
		if (isEmpty || isDefault) continue;
		if (Array.isArray(raw)) {
			for (const item of raw) url.searchParams.append(key, String(item));
		} else {
			url.searchParams.set(key, String(raw));
		}
	}
	const next = url.pathname + url.search + url.hash;
	if (
		next ===
		window.location.pathname + window.location.search + window.location.hash
	) {
		return;
	}
	// 保留 history.state（furin 在里面存了滚动恢复用的 _furinKey）
	window.history.replaceState(window.history.state, "", next);
}

/**
 * 后台页内状态（Tab / 筛选 / 分页 / 详情 id）的浅层 URL 同步。
 *
 * 后台这些状态需要「刷新能还原、链接能分享」，但**不能**触发 furin 的页面导航：
 * furin 的任意导航都会重新请求 `?_furin=data` 并提交一个新的页面快照，
 * 结果是切一个 Tab 就闪一次骨架、改一次筛选输入框就丢焦点——这正是旧后台
 * 「不像 SPA」的另一半原因。
 *
 * 做法：
 * - 状态放在 React state 里，组件不重挂载，交互是纯客户端的；
 * - 地址栏用 `history.replaceState` 改写（`@web/lib/nav` patch 过 history，
 *   会同步 `useLocation`，所以侧栏高亮 / 面包屑照常更新）；
 * - `replace` 不产生历史记录，与旧实现里筛选、分页 `replace: true` 的语义一致。
 *
 * 初始值来自页面 props（furin 已按 `config.query` 的 schema 解析过 URL），
 * 因此深链 / 刷新依旧还原到同一个视图。
 */
export function useShallowSearch<T extends ShallowSearch>(
	initial: T,
	defaults?: Partial<T>,
): [T, (patch: Patch<T>) => void] {
	const [search, setSearch] = useState<T>(initial);
	// defaults 只影响 URL 序列化，不参与渲染，用 ref 避免调用方每次传新对象时重建回调
	const defaultsRef = useRef(defaults);
	defaultsRef.current = defaults;

	const update = useCallback((patch: Patch<T>) => {
		setSearch((previous) => {
			const partial =
				typeof patch === "function"
					? (patch as (current: T) => Partial<T>)(previous)
					: patch;
			// 只做纯状态更新：副作用（写地址栏）放到下面的 effect，
			// 否则会在渲染阶段同步通知全站 location 订阅者。
			return { ...previous, ...partial };
		});
	}, []);

	// 挂载时不写：地址栏就是 initial 的来源，写一次只会因参数顺序不同而重排 query
	// 并触发一次全站 location 通知。用「与初始值同一对象」判断而不是一次性布尔，
	// 这样 StrictMode 下 effect 双跑也只会跳过（幂等）。
	const initialRef = useRef(search);

	// 地址栏同步：search 变化后写
	useEffect(() => {
		if (search === initialRef.current) return;
		writeShallowUrl(search, defaultsRef.current);
	}, [search]);

	return [search, update];
}
