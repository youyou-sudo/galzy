import { X } from "lucide-react";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { PhotoProvider, PhotoView } from "react-photo-view";

/**
 * 游戏封面灯箱。
 *
 * 沿用 Yohaku 同款交互：点击封面时从缩略图所在位置展开，支持拖拽/双指缩放、
 * 双击放大、下滑关闭、Esc 关闭；多图时可左右切换（当前详情页只有封面一张）。
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
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	// 焦点管理：打开时聚焦关闭按钮并给 Portal 补上无障碍属性，关闭后把焦点
	// 还给封面。库本身只做了滚动锁定与 Esc 关闭，不处理焦点。
	useEffect(() => {
		if (!visible) return;
		previousFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		// Portal 与工具栏在 Provider 内部异步挂载（工具栏还要等 PhotoView 暴露
		// scale/rotate），所以按帧重试到节点就绪，再补无障碍属性并聚焦关闭按钮。
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

	return (
		<PhotoProvider
			className="galzy-lightbox galzy-lightbox--single"
			easing={() => "cubic-bezier(0.32, 0.72, 0, 1)"}
			maskClosable
			maskOpacity={0.94}
			onVisibleChange={setVisible}
			pullClosable
			speed={() => 340}
			toolbarRender={({ onClose }) => (
				<button
					aria-label="关闭大图"
					className="galzy-lightbox__close"
					onClick={onClose}
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
		>
			<PhotoView src={src}>{children}</PhotoView>
		</PhotoProvider>
	);
}
