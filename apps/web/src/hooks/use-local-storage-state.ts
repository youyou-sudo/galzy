import { useCallback, useEffect, useRef, useState } from "react";

/**
 * localStorage 持久化的 UI 状态（列显隐、行密度、视图模式等）。
 *
 * SSR 首帧必须与客户端一致：初始值永远用调用方给的 initial，
 * 挂载后再从 localStorage 补水，避免 hydration mismatch。
 */
export function useLocalStorageState<T>(key: string, initial: T) {
	const [state, setState] = useState<T>(initial);
	const hydrated = useRef(false);

	useEffect(() => {
		if (hydrated.current) return;
		hydrated.current = true;
		try {
			const raw = window.localStorage.getItem(key);
			if (raw != null) setState(JSON.parse(raw) as T);
		} catch {
			// 忽略损坏的本地值：保持 initial
		}
	}, [key]);

	const set = useCallback(
		(next: T | ((previous: T) => T)) => {
			setState((previous) => {
				const value =
					typeof next === "function"
						? (next as (previous: T) => T)(previous)
						: next;
				try {
					window.localStorage.setItem(key, JSON.stringify(value));
				} catch {
					// 隐私模式下写入失败：内存态仍然生效
				}
				return value;
			});
		},
		[key],
	);

	return [state, set] as const;
}
