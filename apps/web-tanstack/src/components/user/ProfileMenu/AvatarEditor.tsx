import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Button } from "@web/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@web/components/ui/dialog";
import { authClient } from "@web/server/auth/auth-client";
import {
	Camera,
	ImagePlus,
	Loader2,
	Minus,
	Plus,
	RotateCw,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { rgbaToThumbHash } from "thumbhash";

interface AvatarEditorProps {
	name?: string | null;
	image?: string | null;
	editor: boolean;
}

/** 将裁剪区域从原图导出为 JPEG Blob */
async function getCroppedBlob(
	imageSrc: string,
	pixelCrop: Area,
): Promise<Blob> {
	const blob = await fetch(imageSrc).then((r) => r.blob());
	const bitmap = await createImageBitmap(blob);
	const canvas = document.createElement("canvas");
	canvas.width = pixelCrop.width;
	canvas.height = pixelCrop.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context 获取失败");
	ctx.drawImage(
		bitmap,
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height,
		0,
		0,
		pixelCrop.width,
		pixelCrop.height,
	);
	bitmap.close();
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((b) => {
			if (b) resolve(b);
			else reject(new Error("Canvas toBlob 失败"));
		}, "image/jpeg");
	});
}

/** XHR 上传并回调进度 */
function uploadWithProgress(
	url: string,
	formData: FormData,
	onProgress: (pct: number) => void,
): Promise<{ url: string }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", url);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable)
				onProgress(Math.round((e.loaded / e.total) * 100));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					resolve(JSON.parse(xhr.responseText));
				} catch {
					resolve({ url: "" });
				}
			} else {
				reject(new Error(`上传失败 (${xhr.status})`));
			}
		};
		xhr.onerror = () => reject(new Error("网络错误"));
		xhr.send(formData);
	});
}

/** 将 Blob 转为 ThumbHash 十六进制字符串 */
async function blobToThumbHashHex(blob: Blob): Promise<string> {
	const bitmap = await createImageBitmap(blob);
	const scale = Math.min(1, 100 / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas 2D context 获取失败");
	ctx.drawImage(bitmap, 0, 0, w, h);
	const imageData = ctx.getImageData(0, 0, w, h);
	bitmap.close();
	const hash = rgbaToThumbHash(w, h, imageData.data);
	return Array.from(hash)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export default function AvatarComp({ name, image, editor }: AvatarEditorProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();
	const blobUrlRef = useRef<string | null>(null);

	// ------ 状态 ------
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [cropOpen, setCropOpen] = useState(false);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [isUploading, setIsUploading] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [imageLoadError, setImageLoadError] = useState(false);
	const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");

	/** 回收当前 Blob URL（若存在） */
	const revokeBlobUrl = useCallback(() => {
		if (blobUrlRef.current) {
			URL.revokeObjectURL(blobUrlRef.current);
			blobUrlRef.current = null;
		}
	}, []);

	// ------ 组件卸载时回收 Blob URL (防止内存泄漏) ------
	useEffect(() => revokeBlobUrl, [revokeBlobUrl]);

	// ------ 上传 mutation ------
	const mutation = useMutation({
		mutationFn: async () => {
			if (!previewUrl || !croppedAreaPixels) return { url: "" };

			// 1. 从原图裁剪出 Blob
			const croppedBlob = await getCroppedBlob(previewUrl, croppedAreaPixels);

			// 2. 计算 ThumbHash 作为文件名
			const hash = await blobToThumbHashHex(croppedBlob);

			// 3. 构建 FormData
			const formData = new FormData();
			formData.append("image", croppedBlob, `${hash}.jpg`);

			// 4. XHR 上传 + 进度
			setPhase("uploading");
			setIsUploading(true);
			setUploadProgress(0);
			const result = await uploadWithProgress(
				"/api/upload/",
				formData,
				setUploadProgress,
			);
			setIsUploading(false);

			// 5. 进入保存阶段（更新用户信息）
			setPhase("saving");
			return result;
		},
		onError: () => {
			setIsUploading(false);
			setPhase("idle");
			toast.error("头像更新失败喵～");
		},
		onSuccess: async (data) => {
			if (data.url) {
				await authClient.updateUser({ image: data.url });
			}
			await queryClient.invalidateQueries({ queryKey: ["auth"] });
			toast.success("头像已更新喵～");
			handleCleanup();
		},
	});

	/** 清理编辑器状态 */
	const handleCleanup = useCallback(() => {
		revokeBlobUrl();
		setPreviewUrl(null);
		setCropOpen(false);
		setUploadProgress(0);
		setImageLoadError(false);
		setPhase("idle");
	}, [revokeBlobUrl]);

	/** 处理图片文件（供文件选择和拖拽复用） */
	const processFile = useCallback(
		(file: File) => {
			if (!file.type.startsWith("image/")) {
				toast.error("请选择图片文件喵");
				return;
			}
			if (file.size > 5 * 1024 * 1024) {
				toast.error("图片大小不能超过 5MB 喵");
				return;
			}

			revokeBlobUrl();

			const url = URL.createObjectURL(file);
			blobUrlRef.current = url;
			setPreviewUrl(url);
			setCrop({ x: 0, y: 0 });
			setZoom(1);
			setImageLoadError(false);
			setPhase("idle");
			setCropOpen(true);
		},
		[revokeBlobUrl],
	);

	// ------ 文件选择 ------
	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			processFile(file);
			e.target.value = "";
		},
		[processFile],
	);

	// ------ 拖拽支持 ------
	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	}, []);

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		// 只有真正离开容器时才关闭拖拽状态（避免子元素闪烁）
		if (e.currentTarget.contains(e.relatedTarget as Node)) return;
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);

			const file = e.dataTransfer.files?.[0];
			if (!file) return;
			processFile(file);
		},
		[processFile],
	);

	/** 确认裁剪 → 触发上传 */
	const handleConfirmCrop = useCallback(
		() => mutation.mutate(),
		[mutation.mutate],
	);

	/** 取消裁剪 */
	const handleCancelCrop = useCallback(() => {
		handleCleanup();
	}, [handleCleanup]);

	// ------ 缩放控制 ------
	const ZOOM_MIN = 1;
	const ZOOM_MAX = 3;
	const ZOOM_STEP = 0.15;

	const handleZoomIn = useCallback(
		() => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX)),
		[],
	);
	const handleZoomOut = useCallback(
		() => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN)),
		[],
	);
	const handleZoomReset = useCallback(() => setZoom(1), []);
	const zoomAtMin = zoom <= ZOOM_MIN;
	const zoomAtMax = zoom >= ZOOM_MAX;

	// ------ 快捷键 (Enter 快速确认) ------
	const handleDialogKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" && !mutation.isPending && !isUploading) {
				e.preventDefault();
				handleConfirmCrop();
			}
		},
		[mutation.isPending, isUploading, handleConfirmCrop],
	);

	// ------ 渲染 ------
	const displaySrc = image ?? undefined;
	const fallbackChar = name?.charAt(0).toUpperCase() || "U";
	const hasExistingAvatar = !!image;
	const isProcessing = mutation.isPending || isUploading;

	return (
		<>
			{/* ====== 头像显示 + 点击触发 / 拖拽区域 ====== */}
			<div className="flex flex-col items-center gap-3">
				<div className="group/avatar flex flex-col justify-center">
					{editor ? (
						<button
							type="button"
							className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
							onClick={() => fileInputRef.current?.click()}
							disabled={isProcessing}
							aria-label={hasExistingAvatar ? "更换头像" : "添加头像"}
							onDragOver={handleDragOver}
							onDragEnter={handleDragEnter}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
						>
							<Avatar size="lg" className="size-20">
								<AvatarImage src={displaySrc} alt={name ?? ""} />
								<AvatarFallback className="text-2xl">
									{fallbackChar}
								</AvatarFallback>
							</Avatar>

							{/* 默认悬停遮罩 — 提示点击更换 */}
							<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100">
								<Camera className="size-6 text-white" />
							</div>

							{/* 始终显示的摄像头角标 */}
							<div className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary/70 shadow-xs ring-2 ring-background">
								<Camera className="size-2.5 text-primary-foreground" />
							</div>

							{/* 拖拽悬停提示 */}
							{isDragging && (
								<div className="absolute inset-0 flex items-center justify-center rounded-full bg-primary/60 ring-4 ring-primary/40 transition-all">
									<div className="flex flex-col items-center gap-1">
										<ImagePlus className="size-7 text-white" />
										<span className="text-xs font-medium text-white drop-shadow-xs">
											松开上传
										</span>
									</div>
								</div>
							)}

							{/* 加载遮罩 */}
							{isProcessing && (
								<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
									{phase === "uploading" ? (
										<div className="flex flex-col items-center gap-0.5">
											<Loader2 className="size-5 animate-spin text-white" />
											<span className="text-[10px] text-white">
												{uploadProgress}%
											</span>
										</div>
									) : (
										<Loader2 className="size-6 animate-spin text-white" />
									)}
								</div>
							)}
						</button>
					) : (
						<div className="relative rounded-full">
							<Avatar size="lg" className="size-20">
								<AvatarImage src={displaySrc} alt={name ?? ""} />
								<AvatarFallback className="text-2xl">
									{fallbackChar}
								</AvatarFallback>
							</Avatar>
						</div>
					)}

					{/* 隐藏文件输入 */}
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						className="hidden"
						onChange={handleFileChange}
					/>
				</div>
			</div>

			{/* ====== 裁剪对话框 ====== */}
			<Dialog
				open={cropOpen}
				onOpenChange={(open) => {
					if (!open) handleCancelCrop();
				}}
			>
				<DialogContent className="sm:max-w-lg" onKeyDown={handleDialogKeyDown}>
					<DialogHeader>
						<DialogTitle>裁剪头像</DialogTitle>
						<DialogDescription>
							拖动或缩放图片，裁剪出满意的正方形头像，按 Enter 键快速确认
						</DialogDescription>
					</DialogHeader>

					{/* 裁剪区域 - 正方形 */}
					<div className="relative aspect-square max-h-96 w-full overflow-hidden rounded-md bg-black/5">
						{previewUrl &&
							(imageLoadError ? (
								<div className="flex h-full items-center justify-center">
									<p className="text-sm text-destructive">
										图片加载失败，请重新选择
									</p>
								</div>
							) : (
								<Cropper
									image={previewUrl}
									crop={crop}
									zoom={zoom}
									aspect={1}
									cropShape="round"
									showGrid={false}
									onCropChange={setCrop}
									onCropComplete={(_, area) => setCroppedAreaPixels(area)}
									onZoomChange={setZoom}
									onError={() => setImageLoadError(true)}
								/>
							))}
					</div>

					{/* 缩放控制 (滑条 + 按钮组) */}
					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							onClick={handleZoomOut}
							disabled={zoomAtMin || isProcessing}
							aria-label="缩小"
						>
							<Minus className="size-3.5" />
						</Button>

						<input
							type="range"
							min={ZOOM_MIN}
							max={ZOOM_MAX}
							step={0.01}
							value={zoom}
							onChange={(e) => setZoom(Number(e.target.value))}
							className="flex-1"
							aria-label="缩放比例"
						/>

						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							onClick={handleZoomIn}
							disabled={zoomAtMax || isProcessing}
							aria-label="放大"
						>
							<Plus className="size-3.5" />
						</Button>

						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={handleZoomReset}
							disabled={zoomAtMin || isProcessing}
							aria-label="重置缩放"
							title="重置缩放"
						>
							<RotateCw className="size-3.5" />
						</Button>
					</div>

					{/* 进度条 */}
					{(phase === "uploading" || phase === "saving") && (
						<div className="space-y-1">
							<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
								<div
									className={`h-full bg-primary transition-all duration-300 ${
										phase === "saving" ? "animate-pulse" : ""
									}`}
									style={{
										width: `${phase === "saving" ? 100 : uploadProgress}%`,
									}}
								/>
							</div>
							<p className="text-center text-xs text-muted-foreground">
								{phase === "uploading"
									? `上传中 ${uploadProgress}%`
									: "正在保存头像..."}
							</p>
						</div>
					)}

					{/* 操作按钮 */}
					<div className="flex items-center justify-between gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => fileInputRef.current?.click()}
							disabled={isProcessing}
							aria-label="重新选择图片"
						>
							<Upload className="size-3.5" />
							重新选择
						</Button>

						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								onClick={handleCancelCrop}
								disabled={isProcessing}
							>
								<X className="size-3.5" />
								取消
							</Button>
							<Button
								size="sm"
								onClick={handleConfirmCrop}
								disabled={isProcessing || !croppedAreaPixels}
							>
								{isProcessing ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										{phase === "uploading" ? "上传中..." : "保存中..."}
									</>
								) : (
									<>
										<Camera className="size-4" />
										确认裁剪
									</>
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
