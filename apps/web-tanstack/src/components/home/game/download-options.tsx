import type { GameModel } from "@api/modules/games/model";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import {
	FileItem,
	Files,
	FolderContent,
	FolderItem,
	FolderTrigger,
	SubFiles,
} from "@web/components/animate-ui/components/radix/files";
import { Copy } from "@web/components/animate-ui/icons/copy";
import { Download } from "@web/components/animate-ui/icons/download";
import { AnimateIcon } from "@web/components/animate-ui/icons/icon";
import { FileListSkeleton } from "@web/components/game/game-tab-skeleton";
import { MarkdownAsync } from "@web/components/markdownAync";
import { CopyButton } from "@web/components/shadcn-io/copy-button";
import { Alert, AlertDescription } from "@web/components/ui/alert";
import { Button } from "@web/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@web/components/ui/dialog";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@web/components/ui/item";
import { Skeleton } from "@web/components/ui/skeleton";
import { EmptyState } from "@web/components/shared/empty-state";
import { IconTile } from "@web/components/shared/icon-tile";
import { useBrowserBackModal } from "@web/hooks/use-browser-back-modal";
import { commitAfterViewTransition } from "@web/lib/reveal-gate";
import { groupSplitArchives } from "@web/lib/split-archives";
import { cn } from "@web/lib/utils";
import { dwAcConst } from "@web/server/game";
import { downCardStore, downmodalActions } from "@web/stores/downCardData";
import { AlertTriangle, FileArchive, Info } from "lucide-react";
import { MotionConfig } from "motion/react";
import { tryit } from "radash";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
// 查询配置独立成模块：见 download-options-queries.ts 顶部注释（避免本组件的
// animate-ui / motion 依赖经 route loader 的 import 被提升进 entry chunk）。
import { filelistQueryOptions } from "./download-options-queries";
import { GlgczujmDl } from "./tips";

const apiroute = getRouteApi("/$id/_layout/");

// 解压密码统一为 玖辞；密码的复制按钮复用下载弹窗（文件信息）中的 CopyButton 组件
const UNZIP_PASSWORD = "玖辞";

/** 弹窗内的解压密码：只读密码 + 复制按钮（顶部提示条与弹窗行共用一份） */
const UnzipPassword = () => (
	<span className="inline-flex relative items-center">
		<span className="px-2 pr-8 py-0.5 font-medium bg-muted/50 rounded-lg ring-1 ring-border/60">
			{UNZIP_PASSWORD}
		</span>
		<CopyButton
			size="default"
			variant="ghost"
			content={UNZIP_PASSWORD}
			aria-label={`复制解压密码 ${UNZIP_PASSWORD}`}
			className="absolute top-1/2 right-0 -translate-y-1/2"
		/>
	</span>
);

const UnzipPasswordAlert = () => {
	return (
		// flex + items-center：图标与文本在同一水平线上居中对齐；文本本身保持左对齐
		<Alert className="flex gap-2 items-center px-3 py-2 mb-3 text-sm text-left bg-muted/30">
			<Info
				aria-hidden="true"
				className="shrink-0 size-4 text-muted-foreground"
			/>
			<AlertDescription className="flex flex-wrap gap-x-1.5 gap-y-1 items-center text-sm text-left text-muted-foreground">
				<span>解压密码均为</span>
				<UnzipPassword />
			</AlertDescription>
		</Alert>
	);
};

export const DownloadOptions = () => {
	const { id } = apiroute.useParams();
	// 懒加载文件列表：下载 tab 才请求，不阻塞进入详情页的点击导航
	//（loader 侧已 prefetchQuery 预热，首次进入也大概率秒出）
	const {
		data: filelist,
		isError,
		error,
		refetch,
	} = useQuery(filelistQueryOptions(id));
	// VT 结束 gate：数据到达时若正处 View Transition 动画中，先保持骨架，
	// 等 commitAfterViewTransition 在动画结束后提交渲染 —— VT 进行中的重渲染
	// 会打断动画帧；useDeferredValue 只降优先级，不保证等动画结束。
	// 该 helper 让同页多个组件的收尾提交按每帧至多 6 个错峰，避免动画结束后
	// 同帧集中提交形成长任务（首片仍在结束后的微任务里立即提交，不加延迟）。
	// 初值取当前 filelist：SSR/无 VT 时直接渲染，且与 SSR 输出一致（无 hydration 抖动）。
	const [settledFilelist, setSettledFilelist] = useState(filelist);
	useEffect(() => {
		if (filelist === undefined) return;
		return commitAfterViewTransition(() => setSettledFilelist(filelist));
	}, [filelist]);

	// 文件服务/上游故障：明确报错并可重试，不再伪装成空文件列表
	if (isError && !settledFilelist) {
		return (
			<EmptyState
				icon={AlertTriangle}
				size="sm"
				title="文件列表加载失败"
				description={
					error instanceof Error && error.message
						? error.message
						: "服务暂时不可用，请稍后重试"
				}
				action={
					<Button size="sm" variant="outline" onClick={() => void refetch()}>
						重试
					</Button>
				}
			/>
		);
	}

	if (!settledFilelist?.game) {
		// 与详情页 pending 态共用同一份文件列表骨架，数据到达前后视觉/高度一致
		return <FileListSkeleton />;
	}

	// 局部包裹（不再由全站 Provider 包裹）：reducedMotion="user" 让 animate-ui /
	// motion 组件跟随系统「减弱动态效果」设置，同时避免 motion/react 进入全站首屏。
	return (
		<MotionConfig reducedMotion="user">
			<>
				<UnzipPasswordAlert />
				<FileExplorer
					items={settledFilelist.game}
					onFileClick={(item) => {
						downmodalActions.open(item);
					}}
				/>
				<DownCardDialog />
			</>
		</MotionConfig>
	);
};

// ---------- 文件浏览器组件 ----------
const FileExplorer = ({
	items,
	onFileClick,
}: {
	items: GameModel.TreeNode[];
	onFileClick: (item: GameModel.TreeNode) => void;
}) => {
	// 树变换（分卷识别 + md 同名判定）会递归遍历并新建节点，
	// 用 useMemo 缓存，仅在 items 引用变化时重算，避免每次渲染重复执行。
	const simplifiedItems = useMemo(() => {
		if (
			items &&
			items[0]?.type === "folder" &&
			Array.isArray(items[0].children)
		) {
			return groupSplitArchives(items[0].children);
		}
		return groupSplitArchives(items);
	}, [items]);

	const renderTree = (nodes: GameModel.TreeNode[]): React.ReactNode => {
		return nodes.map((item) => {
			if (item.type === "folder" && !item.volumes) {
				return (
					<FolderItem value={item.name} key={item.id}>
						<FolderTrigger>{item.name}</FolderTrigger>
						{item.children?.length ? (
							<FolderContent>
								<SubFiles>{renderTree(item.children)}</SubFiles>
							</FolderContent>
						) : null}
					</FolderItem>
				);
			}
			return (
				<FileItem key={item.id} onClick={() => onFileClick(item)}>
					{item.name}
				</FileItem>
			);
		});
	};

	return <Files className="p-1">{renderTree(simplifiedItems || [])}</Files>;
};

// ---------- 下载弹窗 ----------
export const DownCardDialog = () => {
	const data = useSelector(downCardStore, (s) => s.data);
	const open = useSelector(downCardStore, (s) => s.open);

	const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>(
		{},
	);
	const [isCopying, setIsCopying] = useState<Record<string, boolean>>({});

	const { id: game_id } = apiroute.useParams();
	const { closeModal, onOpenChange } = useBrowserBackModal({
		modalId: `game-download:${game_id}`,
		open,
		onClose: downmodalActions.close,
	});
	// 下载 README
	const { data: readmedata } = useQuery({
		queryKey: ["readme", data?.redame, game_id],
		queryFn: async () => {
			const url = await dwAcConst({ data: { path: data?.redame, game_id } });
			return fetch(url!.raw_url).then((res) => res.text());
		},
		// 弹窗已关闭时不再保活 README 请求：data 会为退场动画保留，
		// 但没必要在关闭后继续拉/缓存 README。
		enabled: open && !!data?.redame,
		gcTime: 1000 * 60 * 5,
		staleTime: 1000 * 60 * 10,
	});

	// 对话框关闭时清理状态
	useEffect(() => {
		if (!open) {
			setDownloadingMap({});
			setIsCopying({});
		}
	}, [open]);

	const [mdReady, setMdReady] = useState(false);
	// 下载处理函数
	const handleDownload = async (path: string, game_id: string) => {
		setDownloadingMap((prev) => ({ ...prev, [path]: true }));
		const [err, log] = await tryit(dwAcConst)({ data: { path, game_id } });
		if (err) {
			toast.error("下载请求失败喵～");
		}
		if (log?.raw_url) {
			window.open(log.raw_url, "_blank", "noopener,noreferrer");
			toast.success("已成功请求下载喵～");
		} else {
			toast.error("下载 URL 找不到喵～");
		}

		setDownloadingMap((prev) => ({ ...prev, [path]: false }));
	};

	// 复制处理函数
	const handleCopy = async (text: string, game_id: string) => {
		setIsCopying((prev) => ({ ...prev, [text]: true }));
		try {
			const url = await dwAcConst({ data: { path: text, game_id } });
			await navigator.clipboard.writeText(url!.raw_url);
			toast.success("下载链接已复制喵～");
		} catch {
			toast.error("复制失败喵～");
		} finally {
			setIsCopying((prev) => ({ ...prev, [text]: false }));
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"overflow-y-auto max-h-[85%]",
					// 分卷列表里文件名很长（CJK + 宽字符 + 序号），窄弹窗会把它们挤成
					// 竖条；分卷场景下放宽一档，配合更小的字号保证可读性。
					data?.volumes && "sm:max-w-md",
				)}
			>
				<DialogHeader>
					<DialogTitle>{data?.volumes ? `分卷列表` : `文件信息`}</DialogTitle>
				</DialogHeader>

				{data?.volumes ? (
					<div className="flex flex-col gap-1.5 w-full">
						{data.children?.map((item: any) => (
							<Item
								key={item.id}
								variant="outline"
								className="gap-2 py-2 rounded-xl transition-colors duration-200 hover:bg-muted/40"
							>
								{/* 与文件树保持一致的「文件图标 + 名称」行结构 */}
								<ItemMedia
									variant="icon"
									className="size-8 text-muted-foreground bg-muted/60 rounded-lg ring-1 ring-border/60"
								>
									<FileArchive className="size-4" strokeWidth={1.75} />
								</ItemMedia>
								<ItemContent className="min-w-0">
									<ItemTitle className="w-full text-xs leading-snug line-clamp-2 break-all">
										{item.name}
									</ItemTitle>
									<ItemDescription className="text-xs leading-none tabular-nums">
										{item.size}
									</ItemDescription>
								</ItemContent>
								<ItemActions className="gap-1">
									<AnimateIcon animateOnHover>
										<Button
											variant="outline"
											onClick={() => handleCopy(item?.id || "", game_id)}
											size="icon-sm"
											disabled={isCopying[item?.id] || false}
										>
											{isCopying[item?.id] ? (
												<svg
													className="size-3 animate-spin"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
												>
													<circle
														className="opacity-25"
														cx="12"
														cy="12"
														r="10"
														strokeWidth="4"
													></circle>
													<path
														className="opacity-75"
														fill="currentColor"
														d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
													></path>
												</svg>
											) : (
												<Copy />
											)}
										</Button>
									</AnimateIcon>
									<AnimateIcon animateOnHover>
										<Button
											onClick={() => handleDownload(item?.id, game_id)}
											disabled={downloadingMap[item?.id] || false}
											variant="outline"
											size="sm"
										>
											{downloadingMap[item?.id] ? (
												<span className="flex gap-1 items-center">
													<svg
														className="size-3.5 animate-spin"
														viewBox="0 0 24 24"
													>
														<circle
															className="opacity-25"
															cx="12"
															cy="12"
															r="10"
															stroke="currentColor"
															strokeWidth="4"
														/>
														<path
															className="opacity-75"
															fill="currentColor"
															d="M4 12a8 8 0 018-8v8H4z"
														></path>
													</svg>
													请求中
												</span>
											) : (
												<div className="flex gap-1 items-center">
													<Download />
													下载
												</div>
											)}
										</Button>
									</AnimateIcon>
								</ItemActions>
							</Item>
						))}

						<DialogDescription className="mt-2 text-xs text-center">
							<span>全部下载到同一目录后，解压第一个分卷（part1 / .001）</span>
						</DialogDescription>

						<div className="flex gap-1.5 justify-center items-center mt-2">
							<span className="text-xs text-muted-foreground">解压密码：</span>
							<UnzipPassword />
						</div>
					</div>
				) : (
					<>
						<span className="flex justify-center">
							<IconTile icon={FileArchive} size="lg" tone="muted" />
						</span>

						<span className="text-sm font-medium text-center wrap-break-word">
							{data?.name}
						</span>

						<DialogDescription className="text-center">
							<span className="tabular-nums">{data?.size || `未知大小`}</span>
						</DialogDescription>

						<div className="flex gap-1.5 justify-center items-center mt-2">
							<span className="text-sm text-muted-foreground">解压密码：</span>
							<UnzipPassword />
						</div>

						<DialogFooter className="flex-row gap-2 justify-center sm:justify-center">
							<AnimateIcon animateOnHover>
								<Button
									variant="outline"
									onClick={() => handleCopy(data?.id || "", game_id)}
									size="icon"
									disabled={isCopying[data?.id || ""] || false}
								>
									{isCopying[data?.id || ""] ? (
										<svg
											className="w-4 h-4 animate-spin"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												strokeWidth="4"
											></circle>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
											></path>
										</svg>
									) : (
										<Copy />
									)}
								</Button>
							</AnimateIcon>
							<AnimateIcon animateOnHover>
								<Button
									onClick={() => handleDownload(data?.id || "", game_id)}
									disabled={downloadingMap[data?.id || ""] || false}
									variant="outline"
								>
									{downloadingMap[data?.id || ""] ? (
										<span className="flex gap-2 items-center">
											<svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="4"
												></circle>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8v8H4z"
												></path>
											</svg>
											请求中
										</span>
									) : (
										<div className="flex gap-1 items-center">
											<Download />
											下载
										</div>
									)}
								</Button>
							</AnimateIcon>
							<Button onClick={closeModal} variant="ghost">
								关闭
							</Button>
						</DialogFooter>
					</>
				)}
				{data?.redame && (
					<div className="overflow-y-auto p-3 max-h-96 wrap-break-word bg-muted/20 rounded-xl ring-1 ring-border/60">
						{!mdReady && (
							<div className="space-y-2">
								{Array.from({ length: 3 }).map((_, i) => (
									<Skeleton key={i} className="h-5 rounded-full" />
								))}
							</div>
						)}

						{readmedata && (
							<MarkdownAsync
								readmedata={readmedata}
								onReady={() => setMdReady(true)}
							/>
						)}
					</div>
				)}
				<GlgczujmDl />
			</DialogContent>
		</Dialog>
	);
};
