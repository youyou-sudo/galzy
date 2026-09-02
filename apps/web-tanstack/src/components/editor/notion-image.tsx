"use client";

import { Image as ImageExtension } from "@tiptap/extension-image";
import { type NodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import { cn } from "@web/lib/utils";
import { useEffect, useRef, useState } from "react";

/**
 * Notion 式图片大小调整：
 * 图片选中 / 悬停时，图片左右两侧（垂直中点）各显示一根长条小白手柄。
 * 按住左 / 右手柄水平拖动 → 图片以中心为轴缩放宽度，高度等比跟随，
 * 图片始终保持在列内居中（与 Notion 图片块一致）。
 *
 * 尺寸写回 node attrs（width / height）。编辑器与阅读页图片共用
 * `max-width:100%` + `height:auto` 约束：拖不破容器、永不失比例。
 */

const MIN_WIDTH = 40;

interface ResizeDrag {
	side: "left" | "right";
	startX: number;
	startWidth: number;
	maxWidth: number;
	previewWidth: number;
}

const toNumber = (v: unknown): number | null => {
	if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
	if (typeof v === "string" && v.trim() !== "") {
		const n = Number(v);
		if (Number.isFinite(n) && n > 0) return n;
	}
	return null;
};

function ImageNodeView({
	node,
	selected,
	editor,
	getPos,
	updateAttributes,
}: NodeViewProps) {
	const attrs = node.attrs as {
		src?: string | null;
		alt?: string | null;
		title?: string | null;
		width?: number | string | null;
		height?: number | string | null;
	};

	const outerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const dragRef = useRef<ResizeDrag | null>(null);
	const [resizing, setResizing] = useState(false);

	const explicitWidth = toNumber(attrs.width);
	const explicitHeight = toNumber(attrs.height);
	const aspectFromAttrs =
		explicitWidth && explicitHeight ? explicitWidth / explicitHeight : null;

	useEffect(() => {
		if (!resizing) return;

		const handlePointerMove = (e: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;
			const dx = e.clientX - drag.startX;
			// 中心为轴：拖 1px → 宽度 ±2px，图片居中不变
			const delta = drag.side === "right" ? dx * 2 : -dx * 2;
			const width = Math.round(
				Math.min(drag.maxWidth, Math.max(MIN_WIDTH, drag.startWidth + delta)),
			);
			drag.previewWidth = width;
			const img = imgRef.current;
			if (img) img.style.width = `${width}px`;
		};

		const handlePointerUp = () => {
			const drag = dragRef.current;
			dragRef.current = null;
			setResizing(false);
			if (!drag) return;

			const img = imgRef.current;
			if (img) img.style.width = "";

			const width = drag.previewWidth;
			if (Math.abs(width - drag.startWidth) < 1) return;

			// 等比高度：优先用已知宽高比（attrs），其次用原图自然比例
			const natural =
				img && img.naturalWidth && img.naturalHeight
					? img.naturalWidth / img.naturalHeight
					: null;
			const ratio = aspectFromAttrs ?? natural ?? 1;
			const height = Math.round(width / ratio);
			updateAttributes({ width, height });
		};

		document.addEventListener("pointermove", handlePointerMove);
		document.addEventListener("pointerup", handlePointerUp);
		document.addEventListener("pointercancel", handlePointerUp);
		return () => {
			document.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerup", handlePointerUp);
			document.removeEventListener("pointercancel", handlePointerUp);
		};
	}, [resizing, aspectFromAttrs, updateAttributes]);

	const startResize =
		(side: "left" | "right") => (e: React.PointerEvent<HTMLDivElement>) => {
			if (!editor.isEditable) return;
			e.preventDefault();
			e.stopPropagation();

			const img = imgRef.current;
			const outer = outerRef.current;
			if (!img || !outer) return;

			const startWidth = img.offsetWidth;
			const naturalWidth = img.naturalWidth || startWidth;
			const maxWidth = Math.max(
				startWidth,
				Math.min(naturalWidth, outer.clientWidth),
			);

			dragRef.current = {
				side,
				startX: e.clientX,
				startWidth,
				maxWidth,
				previewWidth: startWidth,
			};
			setResizing(true);
		};

	const selectNode = () => {
		if (!editor.isEditable) return;
		const pos = getPos();
		if (pos === undefined || pos === null) return;
		editor.commands.setNodeSelection(pos);
	};

	return (
		<div
			ref={outerRef}
			className={cn(
				"notion-image-row",
				selected && "is-selected",
				resizing && "is-resizing",
			)}
			contentEditable={false}
			onMouseDown={(e) => {
				// 点图片本体 → 选中该节点（出现蓝色描边与两侧手柄）
				if (e.target === imgRef.current) {
					e.preventDefault();
					selectNode();
				}
			}}
		>
			<img
				ref={imgRef}
				src={attrs.src ?? undefined}
				alt={attrs.alt ?? ""}
				title={attrs.title ?? undefined}
				className="notion-image-img"
				draggable={false}
				style={explicitWidth ? { width: `${explicitWidth}px` } : undefined}
			/>
			{editor.isEditable && (
				<>
					<div
						className="notion-resize-bar"
						data-side="left"
						role="slider"
						aria-label="调整图片宽度"
						aria-orientation="horizontal"
						aria-valuemin={MIN_WIDTH}
						aria-valuemax={dragRef.current?.maxWidth ?? 0}
						aria-valuenow={Math.round(imgRef.current?.offsetWidth ?? explicitWidth ?? 0)}
						onPointerDown={startResize("left")}
					/>
					<div
						className="notion-resize-bar"
						data-side="right"
						role="slider"
						aria-label="调整图片宽度"
						aria-orientation="horizontal"
						aria-valuemin={MIN_WIDTH}
						aria-valuemax={dragRef.current?.maxWidth ?? 0}
						aria-valuenow={Math.round(imgRef.current?.offsetWidth ?? explicitWidth ?? 0)}
						onPointerDown={startResize("right")}
					/>
				</>
			)}
		</div>
	);
}

/**
 * 复刻 Notion 图片缩放手感的 Image 扩展。
 * 替换 @tiptap/extension-image 的默认节点渲染与其内建 resize 手柄。
 */
export const NotionImage = ImageExtension.extend({
	addNodeView() {
		return ReactNodeViewRenderer(ImageNodeView);
	},
});
