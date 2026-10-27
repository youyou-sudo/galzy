import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { StatusPill, type StatusTone } from "@web/components/admin/admin-table";
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
	adminDeleteTopic,
	adminGetAllTopics,
	adminUpdateTopicStatus,
} from "@web/server/admin/topics";
import {
	CircleCheckIcon,
	ExternalLinkIcon,
	EyeOffIcon,
	type LucideIcon,
	MessageSquareTextIcon,
	Trash2Icon,
	Undo2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface TopicUser {
	id: string;
	name: string;
	image?: string | null;
}

interface AdminTopic {
	id: number;
	userId: string;
	title: string;
	summary?: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
	user?: TopicUser | null;
}

type TopicsListData = {
	topics: AdminTopic[];
	total: number;
	totalPages: number;
};

/** 列表筛选：路由预取与组件 useQuery 必须共用这一份构造。 */
export type TopicsFilters = {
	status: string;
	page: number;
	pageSize: number;
};

export const DEFAULT_TOPICS_FILTERS: TopicsFilters = {
	status: "",
	page: 1,
	pageSize: 20,
};

export function topicsQueryOptions(filters: TopicsFilters) {
	return {
		queryKey: adminKeys.topics(filters),
		queryFn: async (): Promise<TopicsListData> => {
			const res = await adminGetAllTopics({
				data: {
					page: filters.page,
					limit: filters.pageSize,
					status: filters.status || undefined,
				},
			});
			if (!res) return { topics: [], total: 0, totalPages: 0 };
			return res as unknown as TopicsListData;
		},
	};
}

const STATUS_META: Record<
	string,
	{ label: string; tone: StatusTone; icon?: LucideIcon }
> = {
	published: { label: "已发布", tone: "success", icon: CircleCheckIcon },
	hidden: { label: "已隐藏", tone: "warning", icon: EyeOffIcon },
	deleted: { label: "已删除", tone: "destructive", icon: Trash2Icon },
};

const STATUS_KEY = ["admin", "topics", "status"] as const;
const DELETE_KEY = ["admin", "topics", "delete"] as const;

export default function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={MessageSquareTextIcon}
				eyebrow="内容管理"
				title="话题管理"
				description="管理全站话题，支持发布、隐藏与删除操作"
			/>

			<TopicsTable />
		</div>
	);
}

function TopicsTable() {
	const [status, setStatus] = useState("");
	const [deleting, setDeleting] = useState<AdminTopic | null>(null);

	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		density,
		setDensity,
		resetToFirstPage,
	} = useAdminTableState({ storageKey: "topics", defaultPageSize: 20 });

	const filters: TopicsFilters = { status, page, pageSize };

	const listQuery = useQuery({
		...topicsQueryOptions(filters),
		placeholderData: (previous) => previous,
	});

	const topics = listQuery.data?.topics ?? [];
	const total = listQuery.data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	const lastError = useRef<unknown>(null);
	useEffect(() => {
		if (!listQuery.error || listQuery.error === lastError.current) return;
		lastError.current = listQuery.error;
		toast.error(
			listQuery.error instanceof Error
				? listQuery.error.message
				: "获取话题列表出错",
		);
	}, [listQuery.error]);

	/* ── 写操作：先改缓存，失败自动回滚 ────────────────────── */

	const statusMutation = useAdminMutation<
		unknown,
		{ id: number; status: string; message: string }
	>({
		mutationFn: ({ id, status: next }) =>
			adminUpdateTopicStatus({ data: { id, status: next } }),
		affects: invalidations.topics,
		optimistic: (qc, { id, status: next }) => {
			patchListItems<AdminTopic>(
				qc,
				adminKeys.topicsRoot(),
				"topics",
				(item) => (item.id === id ? { ...item, status: next } : item),
			);
		},
		successMessage: (_data, { message }) => message,
		mutationKey: STATUS_KEY,
	});

	const remove = useAdminMutation<unknown, { id: number }>({
		mutationFn: ({ id }) => adminDeleteTopic({ data: { id } }),
		affects: invalidations.topics,
		optimistic: (qc, { id }) => {
			// 默认「全部」视图里后端仍会返回软删行：就地改状态，避免 revalidate 后「复活」
			if (status !== "" && status !== "deleted") {
				removeListItems<AdminTopic>(
					qc,
					adminKeys.topicsRoot(),
					"topics",
					(item) => item.id === id,
				);
				return;
			}
			patchListItems<AdminTopic>(
				qc,
				adminKeys.topicsRoot(),
				"topics",
				(item) => (item.id === id ? { ...item, status: "deleted" } : item),
			);
		},
		successMessage: "话题已删除",
		onSuccess: () => setDeleting(null),
		mutationKey: DELETE_KEY,
	});

	const pendingStatus = usePendingMutationVars<{ id: number }>(STATUS_KEY);
	const pendingDelete = usePendingMutationVars<{ id: number }>(DELETE_KEY);

	const resetFilters = () => {
		setStatus("");
		resetToFirstPage();
	};

	const columns: AdminColumn<AdminTopic>[] = [
		{
			id: "id",
			header: "ID",
			mobile: "meta",
			hideBelow: "md",
			cell: (row) => (
				<span className="font-mono text-xs text-muted-foreground">
					#{row.id}
				</span>
			),
		},
		{
			id: "title",
			header: "标题",
			mobile: "title",
			cell: (row) => (
				<div className="flex flex-col gap-0.5 max-w-xs min-w-0">
					<Link
						to={"/topics/$topicId"}
						params={{ topicId: String(row.id) }}
						target="_blank"
						className={cn(
							"inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
							row.status === "deleted" && "text-muted-foreground line-through",
						)}
					>
						<span className="truncate">{row.title}</span>
						<ExternalLinkIcon className="shrink-0 size-3" />
					</Link>
					{row.summary && (
						<span className="text-[11px] truncate text-muted-foreground">
							{row.summary}
						</span>
					)}
				</div>
			),
		},
		{
			id: "author",
			header: "作者",
			mobile: "meta",
			cell: (row) => (
				<span className="text-sm text-muted-foreground">
					{row.user?.name || "未知"}
				</span>
			),
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
			header: "创建时间",
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

	const rowActions = (row: AdminTopic) => {
		const statusPending = pendingStatus.some((item) => item.id === row.id);
		const deletePending = pendingDelete.some((item) => item.id === row.id);
		const restore = row.status === "hidden";
		const canPublish = row.status !== "published" && row.status !== "deleted";

		return (
			<>
				{canPublish && (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={restore ? "恢复话题" : "发布话题"}
						disabled={deletePending || statusPending}
						onClick={() =>
							statusMutation.mutate({
								id: row.id,
								status: "published",
								message: restore ? "话题已恢复" : "话题已发布",
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
					label="更多话题操作"
					actions={[
						{
							label: "隐藏",
							icon: EyeOffIcon,
							hidden: row.status !== "published",
							pending: statusPending,
							onSelect: () =>
								statusMutation.mutate({
									id: row.id,
									status: "hidden",
									message: "话题已隐藏",
								}),
						},
						{
							label: "删除话题",
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
				{ value: "published", label: "已发布" },
				{ value: "hidden", label: "已隐藏" },
				{ value: "deleted", label: "已删除" },
			],
		},
	];

	return (
		<>
			<AdminDataTable<AdminTopic>
				columns={columns}
				rows={topics}
				getRowId={(row) => String(row.id)}
				isLoading={listQuery.isLoading}
				isFetching={listQuery.isFetching}
				skeletonRows={Math.min(pageSize, 8)}
				empty={{
					icon: MessageSquareTextIcon,
					title: status ? "没有该状态的话题" : "暂无话题数据",
					description: status
						? "换一个状态筛选再试"
						: "作者发布话题后会出现在这里",
					action: (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								if (status) {
									resetFilters();
									return;
								}
								void listQuery.refetch();
							}}
						>
							{status ? "清除筛选" : "刷新列表"}
						</Button>
					),
				}}
				getRowClassName={(row) =>
					row.status === "deleted" ? "opacity-60" : undefined
				}
				rowActions={rowActions}
				minWidth="min-w-[820px]"
				density={density}
				toolbar={
					<DataTableToolbar
						filters={statusFilters}
						isFiltered={!!status}
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
				title="删除话题"
				desc="此操作将软删除该话题，状态标记为「已删除」，可在「已删除」筛选中查看。"
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
						{deleting.title}
					</blockquote>
				)}
			</ConfirmDialog>
		</>
	);
}
