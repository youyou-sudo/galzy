import { htmlToPlainText } from "@web/lib/rich-text";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 编辑器草稿（localStorage）类型。content 一律为编辑器产生的 HTML。
 */
export interface EditorDraft {
	title: string;
	content: string;
	savedAt: number;
}

type Snapshot = { title: string; content: string };

export interface UseEditorDraftOptions {
	/** 草稿存储 key（文章 / 帖子等不同编辑场景互相独立） */
	key: string;
	/** 是否处于"正在编辑"状态（对话框打开 / 表单可见）。关闭时自动清理草稿。 */
	active: boolean;
	/**
	 * 订阅表单值变化的函数，返回退订函数。
	 * 例：`(listener) => form.store.subscribe(listener).unsubscribe`，
	 * 订阅期间值变化不会触发父组件重渲染。
	 */
	subscribe: (listener: () => void) => () => void;
	/** 读取最新表单值（title / content，均为编辑器 HTML 形态） */
	getValues: () => Snapshot;
	/** 读取"数据源"快照（编辑对象原文 / 初始值）。当前值与它一致 = 没有改动，不产生草稿。 */
	getInitial: () => Snapshot;
	/** 输入防抖毫秒数（默认 800） */
	debounceMs?: number;
}

export interface UseEditorDraftResult {
	/** 当前可恢复的草稿（存在且尚未消费时为非空） */
	offered: EditorDraft | null;
	/** 放弃草稿并清除存储 */
	discard: () => void;
	/** 已把草稿回填进表单（需先填值再调用），随后按回填值继续自动保存 */
	restore: () => void;
	/** 提交成功后调用，立即清除草稿并抑制后续误存 */
	clear: () => void;
}

function safeGetStoredDraft(key: string): EditorDraft | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<EditorDraft>;
		if (typeof parsed?.content !== "string") return null;
		return {
			title: typeof parsed.title === "string" ? parsed.title : "",
			content: parsed.content,
			savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
		};
	} catch {
		return null;
	}
}

function safeSetStoredDraft(key: string, draft: EditorDraft) {
	try {
		localStorage.setItem(key, JSON.stringify(draft));
	} catch {
		// 存储不可用（隐私模式 / 配额满）时静默失败，不影响编辑
	}
}

function safeRemoveStoredDraft(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {
		// ignore
	}
}

function hasMeaningfulContent(draft: EditorDraft | null): boolean {
	if (!draft) return false;
	return (
		draft.title.trim().length > 0 || htmlToPlainText(draft.content).length > 0
	);
}

function isSameSnapshot(a: Snapshot, b: Snapshot): boolean {
	return a.title === b.title && a.content === b.content;
}

function isMeaningful(values: Snapshot): boolean {
	return (
		values.title.trim().length > 0 || htmlToPlainText(values.content).length > 0
	);
}

/**
 * 编辑器防丢草稿 hook。
 *
 * - 订阅表单值变化：仅在偏离"数据源快照"（编辑对象原文 / 初始值）时防抖写入，
 *   用户把内容改回原文时会自动清掉草稿，避免把原文章原文误存成"可恢复草稿"；
 * - 值变化只写 localStorage、不触发父组件重渲染（避免每个按键整棵 Dialog 重渲）；
 * - unhandledrejection / error / pagehide / visibilitychange 时立即刷写最新内容，
 *   浏览器崩溃、刷新、切后台、跳走前不让最近的输入只存在于内存；
 * - 草稿在主动「放弃」或「提交成功（clear）」前一直保留——即使只是关闭对话框、
 *   下次重新打开仍可继续恢复，直到用户真正丢掉它；
 * - active 转 true 时若有可恢复草稿则展示（恢复 / 放弃 / 提交 / 关闭均自行清理 UI）。
 */
export function useEditorDraft({
	key,
	active,
	subscribe,
	getValues,
	getInitial,
	debounceMs = 800,
}: UseEditorDraftOptions): UseEditorDraftResult {
	const [offered, setOffered] = useState<EditorDraft | null>(null);

	const optsRef = useRef({
		key,
		active,
		subscribe,
		getValues,
		getInitial,
		debounceMs,
	});
	optsRef.current = {
		key,
		active,
		subscribe,
		getValues,
		getInitial,
		debounceMs,
	};

	const lastPersistedRef = useRef<Snapshot | null>(null);
	const timerRef = useRef<number | undefined>(undefined);

	function clearTimer() {
		if (timerRef.current !== undefined) {
			window.clearTimeout(timerRef.current);
			timerRef.current = undefined;
		}
	}

	// 写入判断（防抖回调 / 崩溃刷写共用）：无实质改动或等于数据源 → 不产生草稿
	const maybePersist = (values: Snapshot) => {
		const initial = optsRef.current.getInitial();
		if (isSameSnapshot(values, initial)) {
			// 用户删光了改动 / 回到原文 → 无草稿可留
			if (lastPersistedRef.current) {
				safeRemoveStoredDraft(optsRef.current.key);
				lastPersistedRef.current = null;
			}
			return;
		}
		if (!isMeaningful(values)) return;
		if (
			lastPersistedRef.current &&
			isSameSnapshot(values, lastPersistedRef.current)
		)
			return;
		lastPersistedRef.current = values;
		const now = Date.now();
		safeSetStoredDraft(optsRef.current.key, {
			title: values.title,
			content: values.content,
			savedAt: now,
		});
	};

	const flush = useCallback(() => {
		const { active: isActive, getValues: read } = optsRef.current;
		if (typeof window === "undefined" || !isActive) return;
		clearTimer();
		maybePersist(snapshotOf(read()));
	}, []);

	// 订阅表单变化 → 防抖持久化（注册一次，事件处理仅触发调度，不 setState）
	useEffect(() => {
		if (typeof window === "undefined") return;
		const unsubscribe = optsRef.current.subscribe(() => {
			const { active: isActive, debounceMs: ms } = optsRef.current;
			if (!isActive) return;
			clearTimer();
			timerRef.current = window.setTimeout(() => {
				maybePersist(snapshotOf(optsRef.current.getValues()));
			}, ms);
		});

		const onVisibility = () => {
			if (document.visibilityState === "hidden") flush();
		};
		const onRejection = () => flush();
		const onError = () => flush();
		window.addEventListener("unhandledrejection", onRejection);
		window.addEventListener("error", onError);
		window.addEventListener("pagehide", flush);
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			clearTimer();
			unsubscribe();
			window.removeEventListener("unhandledrejection", onRejection);
			window.removeEventListener("error", onError);
			window.removeEventListener("pagehide", flush);
			document.removeEventListener("visibilitychange", onVisibility);
			// 卸载瞬间（崩溃前清理）尽量保存一笔
			flush();
		};
	}, []);

	// active / key 变化：重新评估可恢复草稿（打开时读取展示；key 换对象时重置）
	useEffect(() => {
		if (typeof window === "undefined") return;
		clearTimer();
		lastPersistedRef.current = null;
		setOffered(null);
		if (!active) return;
		const stored = safeGetStoredDraft(optsRef.current.key);
		if (stored && hasMeaningfulContent(stored)) {
			const initial = optsRef.current.getInitial();
			const draftSnap: Snapshot = {
				title: stored.title,
				content: stored.content,
			};
			if (!isSameSnapshot(draftSnap, initial)) {
				setOffered(stored);
			} else {
				// 草稿与数据源一致（如已在别处提交过）→ 无保留价值，清掉
				safeRemoveStoredDraft(optsRef.current.key);
			}
		}
	}, [active, key]);

	return {
		offered,
		discard: useCallback(() => {
			setOffered(null);
			clearTimer();
			safeRemoveStoredDraft(optsRef.current.key);
			lastPersistedRef.current = null;
		}, []),
		restore: useCallback(() => {
			setOffered(null);
			// 草稿已回填进表单（由调用方先 form.reset / handleChange）。
			// 不回写存储：随后编辑继续自动保存，且本轮草稿仍在，崩溃仍可再恢复；
			// 直到「提交成功 clear」或「明确放弃」才会真正清掉。
		}, []),
		clear: useCallback(() => {
			setOffered(null);
			clearTimer();
			safeRemoveStoredDraft(optsRef.current.key);
			lastPersistedRef.current = null;
			// 抑制后续对同一内容再次落盘（提交成功后本轮内容不再值得保存）
			const current = snapshotOf(optsRef.current.getValues());
			const initial = optsRef.current.getInitial();
			if (isSameSnapshot(current, initial)) return;
			lastPersistedRef.current = current;
		}, []),
	};
}

function snapshotOf(values: { title?: string; content?: string }): Snapshot {
	return { title: values.title ?? "", content: values.content ?? "" };
}
