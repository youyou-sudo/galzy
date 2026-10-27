import { useQuery } from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
import { AdminUserTooltip } from "@web/components/admin/admin-user-tooltip";
import { ConfirmDialog } from "@web/components/admin/confirm-dialog";
import {
	type AdminColumn,
	AdminDataTable,
	type AdminFilter,
	DataTablePagination,
	DataTableToolbar,
	RowActionsMenu,
} from "@web/components/admin/data-table";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@web/components/ui/dialog";
import { Label } from "@web/components/ui/label";
import { Spinner } from "@web/components/ui/spinner";
import { Textarea } from "@web/components/ui/textarea";
import { Toggle } from "@web/components/ui/toggle";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import {
	useAdminMutation,
	usePendingMutationVars,
} from "@web/hooks/use-admin-mutation";
import { useAdminTableState } from "@web/hooks/use-admin-table-state";
import {
	formatRelativeTime,
	patchListItems,
	removeListItems,
} from "@web/lib/admin/optimistic";
import { adminKeys, invalidations } from "@web/lib/admin/query-keys";
import { cn } from "@web/lib/utils";
import {
	adminChangeCommentStatus,
	adminDeleteComment,
	adminGetAllComments,
	adminTogglePin,
	adminUpdateComment,
} from "@web/server/admin/comments";
import {
	CornerDownRightIcon,
	ExternalLinkIcon,
	EyeIcon,
	EyeOffIcon,
	type LucideIcon,
	MessageSquareIcon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface CommentUser {
	id: string;
	name: string;
	email: string;
	image?: string | null;
}

interface AdminComment {
	id: string;
	targetType: string;
	targetId: string;
	userId: string;
	content: string;
	type: string;
	status: string;
	isPinned: boolean;
	parentId: string | null;
	rootId: string | null;
	depth: number;
	replyToUserId: string | null;
	createdAt: string;
	updatedAt: string;
	user?: CommentUser | null;
}

type CommentsListData = {
	comments: AdminComment[];
	total: number;
	totalPages: number;
};

/** 列表筛选：路由预取与组件 useQuery 必须共用这一份构造。 */
export type CommentsFilters = {
	targetId: string;
	status: string;
	type: string;
	excludeReplies: boolean;
	page: number;
	pageSize: number;
};

export const DEFAULT_COMMENTS_FILTERS: CommentsFilters = {
	targetId: "",
	status: "",
	type: "",
	excludeReplies: false,
	page: 1,
	pageSize: 20,
};

export function commentsQueryOptions(filters: CommentsFilters) {
	return {
		queryKey: adminKeys.comments(filters),
		queryFn: async (): Promise<CommentsListData> => {
			const res = await adminGetAllComments({
				data: {
					page: filters.page,
					limit: filters.pageSize,
					targetId: filters.targetId || undefined,
					status: filters.status || undefined,
					type: filters.type || undefined,
					excludeReplies: filters.excludeReplies || undefined,
				},
			});
			if (!res) return { comments: [], total: 0, totalPages: 0 };
			return res as unknown as CommentsListData;
		},
	};
}

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
	normal: { label: "正常", tone: "success" },
	hidden: { label: "隐藏", tone: "warning" },
	deleted: { label: "已删除", tone: "destructive" },
};

const TYPE_LABEL: Record<string, string> = {
	comment: "讨论",
	feedback: "反馈",
	question: "提问",
};

const PIN_KEY = ["admin", "comments", "pin"] as const;
const STATUS_KEY = ["admin", "comments", "status"] as const;
const DELETE_KEY = ["admin", "comments", "delete"] as const;

export default function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={MessageSquareIcon}
				eyebrow="内容管理"
				title="评论管理"
				description="管理全站评论与回复，支持编辑、删除、状态变更与置顶操作"
			/>

			<CommentsTable />
		</div>
	);
}

function targetUrlOf(comment: AdminComment): string | null {
	if (comment.targetType === "game") {
		return `/${comment.targetId}`;
	}
	return null;
}

/** 行内图标操作：统一 tooltip + pending 转圈，避免每个页面各写一遍。 */
function IconAction({
	icon: Icon,
	label,
	onClick,
	pending = false,
	disabled = false,
	tone,
}: {
	icon: LucideIcon;
	label: string;
	onClick: () => void;
	pending?: boolean;
	disabled?: boolean;
	tone?: string;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={label}
						disabled={disabled || pending}
						onClick={onClick}
					/>
				}
			>
				{pending ? (
					<Spinner className="size-4" />
				) : (
					<Icon className={cn("size-4", tone)} />
				)}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function CommentsTable() {
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [type, setType] = useState("");
	const [excludeReplies, setExcludeReplies] = useState(false);
	const [editing, setEditing] = useState<AdminComment | null>(null);
	const [deleting, setDeleting] = useState<AdminComment | null>(null);

	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		density,
		setDensity,
		resetToFirstPage,
	} = useAdminTableState({ storageKey: "comments", defaultPageSize: 20 });

	const filters: CommentsFilters = {
		targetId: search,
		status,
		type,
		excludeReplies,
		page,
		pageSize,
	};

	const listQuery = useQuery({
		...commentsQueryOptions(filters),
		placeholderData: (previous) => previous,
	});

	const comments = listQuery.data?.comments ?? [];
	const total = listQuery.data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	// 同一份错误只提示一次，避免后台刷新失败时连续弹多个 toast
	const lastError = useRef<unknown>(null);
	useEffect(() => {
		if (!listQuery.error || listQuery.error === lastError.current) return;
		lastError.current = listQuery.error;
		toast.error(
			listQuery.error instanceof Error
				? listQuery.error.message
				: "获取评论列表出错",
		);
	}, [listQuery.error]);

	/* ── 写操作：先改缓存，失败自动回滚 ────────────────────── */

	const edit = useAdminMutation<unknown, { id: string; content: string }>({
		mutationFn: ({ id, content }) =>
			adminUpdateComment({ data: { id, content } }),
		affects: invalidations.comments,
		optimistic: (qc, { id, content }) => {
			patchListItems<AdminComment>(
				qc,
				adminKeys.commentsRoot(),
				"comments",
				(item) => (item.id === id ? { ...item, content } : item),
			);
		},
		successMessage: "评论内容已更新",
		onSuccess: () => setEditing(null),
	});

	const pin = useAdminMutation<unknown, { id: string; pinned: boolean }>({
		mutationFn: ({ id }) => adminTogglePin({ data: { id } }),
		affects: invalidations.comments,
		optimistic: (qc, { id, pinned }) => {
			patchListItems<AdminComment>(
				qc,
				adminKeys.commentsRoot(),
				"comments",
				(item) => (item.id === id ? { ...item, isPinned: pinned } : item),
			);
		},
		successMessage: (_data, { pinned }) =>
			pinned ? "已置顶该评论" : "已取消置顶",
		mutationKey: PIN_KEY,
	});

	const statusMutation = useAdminMutation<
		unknown,
		{ id: string; status: string }
	>({
		mutationFn: ({ id, status: next }) =>
			adminChangeCommentStatus({ data: { id, status: next } }),
		affects: invalidations.comments,
		optimistic: (qc, { id, status: next }) => {
			patchListItems<AdminComment>(
				qc,
				adminKeys.commentsRoot(),
				"comments",
				(item) => (item.id === id ? { ...item, status: next } : item),
			);
		},
		successMessage: (_data, { status: next }) =>
			next === "hidden" ? "评论已隐藏" : "评论已恢复",
		mutationKey: STATUS_KEY,
	});

	const remove = useAdminMutation<unknown, { id: string }>({
		mutationFn: ({ id }) => adminDeleteComment({ data: { id } }),
		affects: invalidations.comments,
		optimistic: (qc, { id }) => {
			// 默认「全部」视图里后端仍会返回软删行：就地把状态改成 deleted，
			// 否则乐观移除后 revalidate 又会让这一行「自己回来」。
			if (status !== "" && status !== "deleted") {
				removeListItems<AdminComment>(
					qc,
					adminKeys.commentsRoot(),
					"comments",
					(item) => item.id === id,
				);
				return;
			}
			patchListItems<AdminComment>(
				qc,
				adminKeys.commentsRoot(),
				"comments",
				(item) => (item.id === id ? { ...item, status: "deleted" } : item),
			);
		},
		successMessage: "评论已删除",
		onSuccess: () => setDeleting(null),
		mutationKey: DELETE_KEY,
	});

	const pendingPin = usePendingMutationVars<{ id: string }>(PIN_KEY);
	const pendingStatus = usePendingMutationVars<{ id: string }>(STATUS_KEY);
	const pendingDelete = usePendingMutationVars<{ id: string }>(DELETE_KEY);

	const isFiltered = !!search || !!status || !!type || excludeReplies;

	const resetFilters = () => {
		setSearchInput("");
		setSearch("");
		setStatus("");
		setType("");
		setExcludeReplies(false);
		resetToFirstPage();
	};

	const columns: AdminColumn<AdminComment>[] = [
		{
			id: "user",
			header: "用户",
			mobile: "title",
			cell: (row) => (
				<div className="flex flex-col gap-0.5 min-w-0">
					<div className="flex gap-1.5 items-center min-w-0">
						{row.depth > 0 && (
							<CornerDownRightIcon className="shrink-0 size-3.5 text-muted-foreground" />
						)}
						<AdminUserTooltip user={row.user} className="text-sm font-medium" />
						{row.isPinned && (
							<PinIcon className="shrink-0 size-3 text-warning" />
						)}
					</div>
					{row.depth > 0 && (
						<span className="text-[11px] text-muted-foreground">
							回复 #{row.parentId?.slice(0, 8) ?? "-"}
						</span>
					)}
				</div>
			),
		},
		{
			id: "content",
			header: "内容",
			mobile: "body",
			cell: (row) => (
				<p
					className={cn(
						"max-w-xs text-sm truncate",
						row.depth > 0 ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{row.content}
				</p>
			),
		},
		{
			id: "target",
			header: "目标",
			mobile: "meta",
			hideBelow: "md",
			cell: (row) => {
				const url = targetUrlOf(row);
				const label = `${row.targetType}/${row.targetId?.slice(0, 8)}`;
				if (!url) {
					return <span className="text-xs text-muted-foreground">{label}</span>;
				}
				return (
					<a
						href={url}
						target="_blank"
						rel="noreferrer"
						className="inline-flex gap-1 items-center text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80"
					>
						{label}
						<ExternalLinkIcon className="shrink-0 size-3" />
					</a>
				);
			},
		},
		{
			id: "type",
			header: "类型",
			mobile: "meta",
			hideBelow: "lg",
			cell: (row) => (
				<Badge variant="secondary" className="font-normal">
					{TYPE_LABEL[row.type] ?? row.type}
				</Badge>
			),
		},
		{
			id: "status",
			header: "状态",
			mobile: "meta",
			cell: (row) => {
				const meta = STATUS_META[row.status] ?? {
					label: row.status,
					tone: "neutral" as const,
				};
				return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
			},
		},
		{
			id: "createdAt",
			header: "时间",
			mobile: "meta",
			cell: (row) => (
				<Tooltip>
					<TooltipTrigger
						render={
							<span className="text-xs whitespace-nowrap text-muted-foreground" />
						}
					>
						{formatRelativeTime(row.createdAt)}
					</TooltipTrigger>
					<TooltipContent>
						{new Date(row.createdAt).toLocaleString("zh-CN")}
					</TooltipContent>
				</Tooltip>
			),
		},
	];

	const rowActions = (row: AdminComment) => {
		const pinPending = pendingPin.some((item) => item.id === row.id);
		const statusPending = pendingStatus.some((item) => item.id === row.id);
		const deletePending = pendingDelete.some((item) => item.id === row.id);
		const editable = row.status === "normal";

		return (
			<>
				{editable && (
					<>
						<IconAction
							icon={PencilIcon}
							label="编辑内容"
							disabled={deletePending}
							onClick={() => setEditing(row)}
						/>
						<IconAction
							icon={row.isPinned ? PinOffIcon : PinIcon}
							label={row.isPinned ? "取消置顶" : "置顶"}
							tone={row.isPinned ? "text-warning" : undefined}
							disabled={deletePending}
							pending={pinPending}
							onClick={() => pin.mutate({ id: row.id, pinned: !row.isPinned })}
						/>
					</>
				)}
				{row.status === "normal" && (
					<IconAction
						icon={EyeOffIcon}
						label="隐藏"
						disabled={deletePending}
						pending={statusPending}
						onClick={() =>
							statusMutation.mutate({ id: row.id, status: "hidden" })
						}
					/>
				)}
				{row.status === "hidden" && (
					<IconAction
						icon={EyeIcon}
						label="恢复"
						tone="text-success"
						disabled={deletePending}
						pending={statusPending}
						onClick={() =>
							statusMutation.mutate({ id: row.id, status: "normal" })
						}
					/>
				)}
				<RowActionsMenu
					label="更多评论操作"
					actions={[
						{
							label: "删除评论",
							icon: Trash2Icon,
							variant: "destructive",
							hidden: row.status === "deleted",
							pending: deletePending,
							onSelect: () => setDeleting(row),
						},
					]}
				/>
			</>
		);
	};

	const statusFilters: AdminFilter[] = [
		{
			id: "status",
			label: "状态",
			value: status,
			onChange: (value) => {
				setStatus(value);
				resetToFirstPage();
			},
			options: [
				{ value: "normal", label: "正常" },
				{ value: "hidden", label: "隐藏" },
				{ value: "deleted", label: "已删除" },
			],
		},
		{
			id: "type",
			label: "类型",
			value: type,
			onChange: (value) => {
				setType(value);
				resetToFirstPage();
			},
			allLabel: "全部类型",
			options: [
				{ value: "comment", label: "讨论" },
				{ value: "feedback", label: "反馈" },
				{ value: "question", label: "提问" },
			],
		},
	];

	return (
		<>
			<AdminDataTable<AdminComment>
				columns={columns}
				rows={comments}
				getRowId={(row) => row.id}
				isLoading={listQuery.isLoading}
				isFetching={listQuery.isFetching}
				skeletonRows={Math.min(pageSize, 8)}
				empty={{
					icon: MessageSquareIcon,
					title: isFiltered ? "没有符合条件的评论" : "暂无评论数据",
					description: isFiltered
						? "试试调整搜索关键词或筛选条件"
						: "全站还没有产生评论，或评论都已被删除",
					action: (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								if (isFiltered) {
									resetFilters();
									return;
								}
								void listQuery.refetch();
							}}
						>
							{isFiltered ? "清除筛选" : "刷新列表"}
						</Button>
					),
				}}
				getRowClassName={(row) => (row.depth > 0 ? "bg-muted/20" : undefined)}
				rowActions={rowActions}
				minWidth="min-w-[960px]"
				density={density}
				toolbar={
					<DataTableToolbar
						search={{
							value: searchInput,
							onChange: (value) => {
								setSearchInput(value);
								if (!value) {
									setSearch("");
									resetToFirstPage();
								}
							},
							onSubmit: (value) => {
								setSearchInput(value);
								setSearch(value.trim());
								resetToFirstPage();
							},
							placeholder: "搜索目标 ID…",
							ariaLabel: "搜索评论目标 ID",
						}}
						filters={statusFilters}
						isFiltered={isFiltered}
						onReset={resetFilters}
						density={density}
						onDensityChange={setDensity}
						actions={
							<Toggle
								variant="outline"
								size="sm"
								pressed={excludeReplies}
								aria-label="仅显示一级评论"
								onPressedChange={(pressed) => {
									setExcludeReplies(pressed);
									resetToFirstPage();
								}}
							>
								仅一级评论
							</Toggle>
						}
					/>
				}
				footer={
					<DataTablePagination
						page={page}
						pageCount={pageCount}
						total={total}
						pageSize={pageSize}
						onPageChange={setPage}
						onPageSizeChange={setPageSize}
					/>
				}
			/>

			{editing && (
				<EditCommentDialog
					key={editing.id}
					comment={editing}
					isLoading={edit.isPending}
					onCancel={() => setEditing(null)}
					onSubmit={(content) => edit.mutate({ id: editing.id, content })}
				/>
			)}

			<ConfirmDialog
				open={!!deleting}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title="删除评论"
				desc="此操作将软删除该评论，状态标记为「已删除」，可在「已删除」筛选中查看。"
				confirmText="确认删除"
				destructive
				isLoading={remove.isPending}
				onConfirm={() => {
					if (!deleting) return;
					remove.mutate({ id: deleting.id });
				}}
			>
				{deleting && (
					<blockquote className="pl-3 text-sm italic text-muted-foreground border-l-2 line-clamp-3">
						{deleting.content}
					</blockquote>
				)}
			</ConfirmDialog>
		</>
	);
}

function EditCommentDialog({
	comment,
	onCancel,
	onSubmit,
	isLoading,
}: {
	comment: AdminComment;
	onCancel: () => void;
	onSubmit: (content: string) => void;
	isLoading: boolean;
}) {
	const [content, setContent] = useState(comment.content);
	const [invalid, setInvalid] = useState(false);

	const submit = () => {
		const next = content.trim();
		if (!next) {
			setInvalid(true);
			return;
		}
		onSubmit(next);
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>编辑评论</DialogTitle>
					<DialogDescription>
						{comment.user?.name ?? "匿名用户"} 的评论，保存后立即对全站生效。
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="admin-comment-content">内容</Label>
					<Textarea
						id="admin-comment-content"
						value={content}
						rows={5}
						aria-invalid={invalid}
						onChange={(event) => {
							setContent(event.target.value);
							setInvalid(false);
						}}
					/>
					{invalid && <p className="text-xs text-destructive">内容不能为空</p>}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel} disabled={isLoading}>
						取消
					</Button>
					<Button onClick={submit} disabled={isLoading}>
						{isLoading && <Spinner className="size-3.5" />}
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
