import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { Button } from "@web/components/ui/button";
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
	adminChangeArticleStatus,
	adminGetAllArticles,
} from "@web/server/admin/articles";
import {
	CircleCheckIcon,
	ClockIcon,
	EyeOffIcon,
	FileTextIcon,
	type LucideIcon,
	PencilIcon,
	Trash2Icon,
	Undo2Icon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface AdminArticleUser {
	id: string;
	name: string;
	email?: string | null;
	image?: string | null;
}

interface AdminArticle {
	id: number;
	vid: string | null;
	otherid: number | null;
	author: string;
	title: string | null;
	content: string | null;
	type: string;
	status: string;
	copyright: string | null;
	createdAt: string;
	updatedAt: string;
	user?: AdminArticleUser | null;
}

type ArticlesListData = {
	articles: AdminArticle[];
	total: number;
	totalPages: number;
};

/** 列表筛选：路由预取与组件 useQuery 必须共用这一份构造。 */
export type ArticlesFilters = {
	search: string;
	status: string;
	type: string;
	page: number;
	pageSize: number;
};

export const DEFAULT_ARTICLES_FILTERS: ArticlesFilters = {
	search: "",
	status: "",
	type: "",
	page: 1,
	pageSize: 20,
};

export function articlesQueryOptions(filters: ArticlesFilters) {
	return {
		queryKey: adminKeys.articles(filters),
		queryFn: async (): Promise<ArticlesListData> => {
			const res = await adminGetAllArticles({
				data: {
					page: filters.page,
					limit: filters.pageSize,
					search: filters.search || undefined,
					status: filters.status || undefined,
					type: filters.type || undefined,
				},
			});
			if (!res) return { articles: [], total: 0, totalPages: 0 };
			return res as unknown as ArticlesListData;
		},
	};
}

const STATUS_META: Record<
	string,
	{ label: string; tone: StatusTone; icon?: LucideIcon }
> = {
	published: { label: "已审核", tone: "success", icon: CircleCheckIcon },
	pending: { label: "待审核", tone: "warning", icon: ClockIcon },
	rejected: { label: "已驳回", tone: "destructive", icon: XCircleIcon },
	hidden: { label: "隐藏", tone: "neutral", icon: EyeOffIcon },
	deleted: { label: "已删除", tone: "destructive", icon: Trash2Icon },
};

const TYPE_META: Record<string, { label: string; tone: StatusTone }> = {
	strategy: { label: "攻略", tone: "primary" },
	blog: { label: "博客", tone: "info" },
	tutorial: { label: "教程", tone: "warning" },
	// 后端文章表与话题表共用，列表里可能出现 type=topic 的行
	topic: { label: "话题", tone: "neutral" },
};

const STATUS_KEY = ["admin", "articles", "status"] as const;
const DELETE_KEY = ["admin", "articles", "delete"] as const;

export default function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={FileTextIcon}
				eyebrow="内容管理"
				title="文章管理"
				description="管理全站攻略文章，支持审核、编辑、隐藏与删除操作"
			/>

			<ArticlesTable />
		</div>
	);
}

function ArticlesTable() {
	const navigate = useNavigate();
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [type, setType] = useState("");
	const [deleting, setDeleting] = useState<AdminArticle | null>(null);

	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		density,
		setDensity,
		resetToFirstPage,
	} = useAdminTableState({ storageKey: "articles", defaultPageSize: 20 });

	const filters: ArticlesFilters = { search, status, type, page, pageSize };

	const listQuery = useQuery({
		...articlesQueryOptions(filters),
		placeholderData: (previous) => previous,
	});

	const articles = listQuery.data?.articles ?? [];
	const total = listQuery.data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	const lastError = useRef<unknown>(null);
	useEffect(() => {
		if (!listQuery.error || listQuery.error === lastError.current) return;
		lastError.current = listQuery.error;
		toast.error(
			listQuery.error instanceof Error
				? listQuery.error.message
				: "获取文章列表出错",
		);
	}, [listQuery.error]);

	/* ── 写操作：先改缓存，失败自动回滚 ────────────────────── */

	const statusMutation = useAdminMutation<
		unknown,
		{ id: number; status: string; message: string }
	>({
		mutationFn: ({ id, status: next }) =>
			adminChangeArticleStatus({ data: { id, status: next } }),
		affects: invalidations.articles,
		optimistic: (qc, { id, status: next }) => {
			patchListItems<AdminArticle>(
				qc,
				adminKeys.articlesRoot(),
				"articles",
				(item) => (item.id === id ? { ...item, status: next } : item),
			);
		},
		successMessage: (_data, { message }) => message,
		mutationKey: STATUS_KEY,
	});

	const remove = useAdminMutation<unknown, { id: number }>({
		mutationFn: ({ id }) =>
			adminChangeArticleStatus({ data: { id, status: "deleted" } }),
		affects: invalidations.articles,
		optimistic: (qc, { id }) => {
			// 默认「全部」视图里后端仍会返回软删行：就地改状态，避免 revalidate 后「复活」
			if (status !== "" && status !== "deleted") {
				removeListItems<AdminArticle>(
					qc,
					adminKeys.articlesRoot(),
					"articles",
					(item) => item.id === id,
				);
				return;
			}
			patchListItems<AdminArticle>(
				qc,
				adminKeys.articlesRoot(),
				"articles",
				(item) => (item.id === id ? { ...item, status: "deleted" } : item),
			);
		},
		successMessage: "文章已删除",
		onSuccess: () => setDeleting(null),
		mutationKey: DELETE_KEY,
	});

	const pendingStatus = usePendingMutationVars<{ id: number }>(STATUS_KEY);
	const pendingDelete = usePendingMutationVars<{ id: number }>(DELETE_KEY);

	const isFiltered = !!search || !!status || !!type;

	const resetFilters = () => {
		setSearchInput("");
		setSearch("");
		setStatus("");
		setType("");
		resetToFirstPage();
	};

	const openEditor = (row: AdminArticle) => {
		navigate({
			to: "/admin/articles/$articleId/edit",
			params: { articleId: String(row.id) },
		});
	};

	const columns: AdminColumn<AdminArticle>[] = [
		{
			id: "title",
			header: "标题",
			mobile: "title",
			cell: (row) => (
				<span
					className={cn(
						"block max-w-xs text-sm font-medium truncate",
						row.status === "deleted" && "text-muted-foreground line-through",
					)}
				>
					{row.title || "无标题"}
				</span>
			),
		},
		{
			id: "author",
			header: "作者",
			mobile: "meta",
			cell: (row) => (
				<AdminUserTooltip
					user={row.user}
					className="text-sm text-muted-foreground"
				/>
			),
		},
		{
			id: "game",
			header: "所属游戏",
			mobile: "meta",
			hideBelow: "md",
			cell: (row) => {
				const gameId = row.vid ?? (row.otherid ? String(row.otherid) : "");
				return (
					<span className="font-mono text-xs text-muted-foreground">
						{gameId || "-"}
					</span>
				);
			},
		},
		{
			id: "type",
			header: "类型",
			mobile: "meta",
			hideBelow: "lg",
			cell: (row) => {
				const meta = TYPE_META[row.type] ?? {
					label: row.type,
					tone: "neutral" as const,
				};
				return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
			},
		},
		{
			id: "status",
			header: "状态",
			mobile: "meta",
			cell: (row) => {
				const meta = STATUS_META[row.status];
				if (!meta) {
					return <StatusPill tone="neutral">{row.status}</StatusPill>;
				}
				return (
					<StatusPill tone={meta.tone} icon={meta.icon}>
						{meta.label}
					</StatusPill>
				);
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

	const rowActions = (row: AdminArticle) => {
		const statusPending = pendingStatus.some((item) => item.id === row.id);
		const deletePending = pendingDelete.some((item) => item.id === row.id);
		const canPublish = row.status !== "published" && row.status !== "deleted";
		const restore = row.status === "hidden";

		return (
			<>
				{row.status !== "deleted" && (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="编辑文章"
						disabled={deletePending}
						onClick={() => openEditor(row)}
					>
						<PencilIcon className="size-4" />
					</Button>
				)}
				{canPublish && (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={restore ? "恢复文章" : "审核通过"}
						disabled={deletePending || statusPending}
						onClick={() =>
							statusMutation.mutate({
								id: row.id,
								status: "published",
								message: restore ? "文章已恢复" : "文章已审核通过",
							})
						}
					>
						{restore ? (
							<Undo2Icon className="size-4 text-success" />
						) : (
							<CircleCheckIcon className="size-4 text-success" />
						)}
					</Button>
				)}
				<RowActionsMenu
					label="更多文章操作"
					actions={[
						{
							label: "驳回",
							icon: XCircleIcon,
							hidden: row.status !== "pending",
							pending: statusPending,
							onSelect: () =>
								statusMutation.mutate({
									id: row.id,
									status: "rejected",
									message: "文章已驳回",
								}),
						},
						{
							label: "隐藏",
							icon: EyeOffIcon,
							hidden: row.status !== "published",
							pending: statusPending,
							onSelect: () =>
								statusMutation.mutate({
									id: row.id,
									status: "hidden",
									message: "文章已隐藏",
								}),
						},
						{
							label: "删除文章",
							icon: Trash2Icon,
							variant: "destructive",
							separator: true,
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
				{ value: "pending", label: "待审核" },
				{ value: "published", label: "已审核" },
				{ value: "rejected", label: "已驳回" },
				{ value: "hidden", label: "已隐藏" },
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
				{ value: "strategy", label: "攻略" },
				{ value: "blog", label: "博客" },
				{ value: "tutorial", label: "教程" },
			],
		},
	];

	return (
		<>
			<AdminDataTable<AdminArticle>
				columns={columns}
				rows={articles}
				getRowId={(row) => String(row.id)}
				isLoading={listQuery.isLoading}
				isFetching={listQuery.isFetching}
				skeletonRows={Math.min(pageSize, 8)}
				empty={{
					icon: FileTextIcon,
					title: isFiltered ? "没有符合筛选条件的文章" : "暂无文章数据",
					description: isFiltered
						? "试试调整搜索关键词或筛选条件"
						: "等待作者投稿，或到前台攻略页创建第一篇文章",
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
				getRowClassName={(row) =>
					row.status === "deleted" ? "opacity-60" : undefined
				}
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
							placeholder: "搜索文章标题…",
							ariaLabel: "搜索文章标题",
						}}
						filters={statusFilters}
						isFiltered={isFiltered}
						onReset={resetFilters}
						density={density}
						onDensityChange={setDensity}
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

			<ConfirmDialog
				open={!!deleting}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title="删除文章"
				desc="此操作将软删除该文章，状态标记为「已删除」，可在「已删除」筛选中查看。"
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
						{deleting.title || "无标题"}
					</blockquote>
				)}
			</ConfirmDialog>
		</>
	);
}
