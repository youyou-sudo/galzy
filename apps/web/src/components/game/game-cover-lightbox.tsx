import { X } from "lucide-react";
import {
	cloneElement,
	type ReactElement,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { PhotoSlider } from "react-photo-view";

/** 灯箱垫在历史栈里的同 URL 条目标记。 */
const LIGHTBOX_HISTORY_MARKER = "__galzyCoverLightbox";

type TriggerProps = {
	onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
};

/**
 * 在不触发 TanStack Router 重新 load 的前提下 push 一个同 URL 历史条目。
 *
 * TanStack history 会把 window.history.pushState 包一层，push 后通知 router.load
 *（同 URL 也会重新跑一遍导航）。这里直接调用 History.prototype 上未被包装的
 * 原生方法，只给返回手势垫一层条目，路由状态保持不变。
 */
function pushLightboxHistoryEntry(): boolean {
	try {
		const state = {
			...window.history.state,
			[LIGHTBOX_HISTORY_MARKER]: true,
		};
		History.prototype.pushState.call(
			window.history,
			state,
			"",
			window.location.href,
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * 游戏封面灯箱。
 *
 * 沿用 Yohaku 同款交互：点击封面时从缩略图所在位置展开，支持拖拽/双指缩放、
 * 双击放大、下滑关闭、Esc 关闭；多图时可左右切换（当前详情页只有封面一张）。
 *
 * 打开时向历史栈压入一个同 URL 条目：手机端侧滑返回/浏览器返回会先退掉这层
 * 条目并关闭灯箱，而不是直接离开条目页；灯箱内主动关闭时再把这层条目 back 掉。
 *
 * react-photo-view 负责手势与展开动画；本组件及库的 CSS 在 styles.css 全局引入，
 * 不随路由 chunk 懒加载（客户端导航时路由 CSS 不会注入，SPA 进入详情页会丢样式）。
 */
export function GameCoverLightbox({
	alt,
	children,
	src,
}: {
	alt: string;
	children: ReactElement;
	src: string;
}) {
	const [visible, setVisible] = useState(false);
	const visibleRef = useRef(visible);
	visibleRef.current = visible;
	/** 当前历史栈顶是否是本灯箱压入的条目。 */
	const historyEntryRef = useRef(false);
	/** 主动 close 已调用 history.back()，等这次 popstate 回来时不要重复处理。 */
	const historyBackPendingRef = useRef(false);
	const originRef = useRef<HTMLElement | null>(null);
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	const images = useMemo(
		() => [{ key: "cover", src, originRef }],
		[src, originRef],
	);

	const open = useCallback(() => {
		// 主动关闭的 back() 尚未落地时忽略再次打开，避免历史条目状态错位。
		if (visibleRef.current || historyBackPendingRef.current) return;
		if (window.history.state?.[LIGHTBOX_HISTORY_MARKER] === true) {
			// 已经位于灯箱历史条目（例如用户 forward 回到这里），直接复用。
			historyEntryRef.current = true;
		} else {
			historyEntryRef.current = pushLightboxHistoryEntry();
		}
		setVisible(true);
	}, []);

	const close = useCallback(() => {
		if (!visibleRef.current) return;
		setVisible(false);
		if (historyEntryRef.current) {
			historyEntryRef.current = false;
			historyBackPendingRef.current = true;
			// 退掉灯箱自己的历史条目；这次 popstate 只用于退栈，不再关一次灯箱。
			window.history.back();
		}
	}, []);

	// 手机侧滑/浏览器返回：当前有灯箱条目时只关闭灯箱，不离开页面。
	useEffect(() => {
		const onPopState = () => {
			if (historyBackPendingRef.current) {
				historyBackPendingRef.current = false;
				return;
			}
			if (!visibleRef.current) return;
			historyEntryRef.current = false;
			setVisible(false);
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	// 焦点管理：打开时聚焦关闭按钮并给 Portal 补上无障碍属性，关闭后把焦点
	// 还给封面。库本身只做了滚动锁定与 Esc 关闭，不处理焦点。
	useEffect(() => {
		if (!visible) return;
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		// Portal 与工具栏在 PhotoSlider 内部异步挂载（工具栏还要等图片节点
		// 暴露 scale/rotate），所以按帧重试到节点就绪，再补无障碍属性并聚焦。
		let frame = 0;
		let attempts = 0;
		const applyA11y = () => {
			const portal = document.querySelector<HTMLElement>(".galzy-lightbox");
			if (portal) {
				portal.setAttribute("aria-label", `${alt} 封面大图`);
				portal.setAttribute("aria-modal", "true");
			}
			const closeButton = closeButtonRef.current;
			if (closeButton) {
				closeButton.focus();
				return;
			}
			if (attempts++ < 20) frame = requestAnimationFrame(applyA11y);
		};
		frame = requestAnimationFrame(applyA11y);

		return () => {
			cancelAnimationFrame(frame);
			previousFocusRef.current?.focus?.();
			previousFocusRef.current = null;
		};
	}, [alt, visible]);

	const triggerChild = children as ReactElement<TriggerProps>;
	const trigger = cloneElement(triggerChild, {
		onClick: (event: ReactMouseEvent<HTMLElement>) => {
			triggerChild.props.onClick?.(event);
			open();
		},
		ref: originRef,
	} as Partial<TriggerProps> & { ref: typeof originRef });

	return (
		<>
			{trigger}
			<PhotoSlider
				className="galzy-lightbox galzy-lightbox--single"
				easing={() => "cubic-bezier(0.32, 0.72, 0, 1)"}
				images={images}
				index={0}
				maskClosable
				maskOpacity={0.94}
				onClose={close}
				pullClosable
				speed={() => 340}
				toolbarRender={() => (
					<button
						aria-label="关闭大图"
						className="galzy-lightbox__close"
						onClick={close}
						onKeyDown={(event) => {
							// 灯箱内只有关闭按钮可聚焦，Tab 不应逃逸到背后的页面。
							if (event.key === "Tab") event.preventDefault();
						}}
						ref={closeButtonRef}
						type="button"
					>
						<X aria-hidden="true" className="size-4.5" strokeWidth={2.25} />
					</button>
				)}
				visible={visible}
			/>
		</>
	);
}
