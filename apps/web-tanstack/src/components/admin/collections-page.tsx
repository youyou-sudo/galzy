import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
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
import { IconTile } from "@web/components/shared/icon-tile";
import { SearchField } from "@web/components/shared/search-field";
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
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import { Spinner } from "@web/components/ui/spinner";
import { Textarea } from "@web/components/ui/textarea";
import {
	useAdminMutation,
	usePendingMutationVars,
} from "@web/hooks/use-admin-mutation";
import { useAdminTableState } from "@web/hooks/use-admin-table-state";
import {
	formatRelativeTime,
	patchListItems,
	prependListItem,
	removeListItems,
} from "@web/lib/admin/optimistic";
import { adminKeys, invalidations } from "@web/lib/admin/query-keys";
import { preferredTitleFrom } from "@web/lib/game-title";
import {
	adminCreateCollection,
	adminDeleteCollection,
	adminGetCollections,
	adminSearchGames,
	adminSearchProducers,
	adminUpdateCollection,
	adminUpdateCollectionEntries,
} from "@web/server/admin/collections";
import {
	Building2Icon,
	ExternalLinkIcon,
	PackageIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * 合集管理页。
 *
 * 写操作全部乐观：发布 / 下架只改缓存里的 status，删除直接把行从列表摘掉，
 * 失败由 useAdminMutation 回滚快照并 toast；筛选与页码状态不会被写操作打回。
 */

// ── 类型与查询 ────────────────────────────────────────────────

export type AdminCollection = {
	id: number;
	title: string;
	description?: string | null;
	type: string;
	producerIds?: string[] | null;
	status: string;
	sortOrder?: number;
	createdAt?: string | null;
	updatedAt?: string | null;
	entries?: { vid: string; sortOrder: number }[] | null;
	entryCount?: number;
};

export type CollectionsListResponse = {
	items: AdminCollection[];
	total: number;
	page?: number;
	limit?: number;
};

export type CollectionsListFilters = {
	status: string;
	/** 1 基页码 */
	page: number;
	limit: number;
};

export const COLLECTIONS_PAGE_SIZE = 20;

/** 路由预取与组件内 useQuery 共用同一构造，避免首屏闪一次空列表。 */
export function collectionsListFilters(
	input: Partial<CollectionsListFilters> = {},
): CollectionsListFilters {
	return {
		status: input.status ?? "",
		page: input.page ?? 1,
		limit: input.limit ?? COLLECTIONS_PAGE_SIZE,
	};
}

export async function fetchCollectionsList(
	filters: CollectionsListFilters,
): Promise<CollectionsListResponse> {
	const res = await adminGetCollections({
		data: {
			page: filters.page,
			limit: filters.limit,
			status: filters.status,
		},
	});
	const data = (res ?? {
		items: [],
		total: 0,
	}) as unknown as CollectionsListResponse;
	return {
		items: data.items ?? [],
		total: Number(data.total ?? 0),
		page: data.page,
		limit: data.limit,
	};
}

// ── 常量 ──────────────────────────────────────────────────────

const COLLECTIONS_MUTATION_KEY = ["admin", "collections", "mutate"] as const;

const COLUMN_META = [
	{ id: "title", label: "标题" },
	{ id: "status", label: "状态" },
	{ id: "entries", label: "游戏数" },
	{ id: "type", label: "类型" },
	{ id: "updatedAt", label: "更新时间" },
];

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
	published: { label: "已发布", tone: "success" },
	hidden: { label: "已隐藏", tone: "warning" },
};

const TYPE_LABEL: Record<string, string> = {
	manual: "手动选择",
	producer: "会社绑定",
};

interface CollectionFormData {
	title: string;
	description: string;
	type: string;
	producerIds: string[];
	status: string;
	entries: { vid: string; sortOrder: number }[];
}

function emptyCollectionForm(): CollectionFormData {
	return {
		title: "",
		description: "",
		type: "manual",
		producerIds: [],
		status: "published",
		entries: [],
	};
}

function formFromCollection(collection: AdminCollection): CollectionFormData {
	return {
		title: collection.title,
		description: collection.description ?? "",
		type: collection.type,
		producerIds: collection.producerIds ?? [],
		status: collection.status,
		entries: (collection.entries ?? []).map((entry) => ({
			vid: entry.vid,
			sortOrder: entry.sortOrder,
		})),
	};
}

function absoluteTime(value: string | null | undefined): string {
	if (!value) return "-";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN");
}

// ── 页面 ──────────────────────────────────────────────────────

export default function CollectionsPage() {
	const [createOpen, setCreateOpen] = useState(false);

	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={PackageIcon}
				eyebrow="内容管理"
				title="合集管理"
				description="管理全站合集，支持创建、编辑、发布与删除"
				actions={
					<Button onClick={() => setCreateOpen(true)}>
						<PlusIcon className="size-4" />
						新建合集
					</Button>
				}
			/>

			<CollectionsTable onCreate={() => setCreateOpen(true)} />

			<CreateCollectionDialog open={createOpen} onOpenChange={setCreateOpen} />
		</div>
	);
}

// ── 列表 ──────────────────────────────────────────────────────

function CollectionsTable({ onCreate }: { onCreate: () => void }) {
	const [statusFilterValue, setStatusFilterValue] = useState("");
	const [editTarget, setEditTarget] = useState<AdminCollection | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<AdminCollection | null>(
		null,
	);

	const table = useAdminTableState({
		storageKey: "collections",
		defaultPageSize: COLLECTIONS_PAGE_SIZE,
		columns: COLUMN_META,
	});

	const filters = collectionsListFilters({
		status: statusFilterValue,
		page: table.page,
		limit: table.pageSize,
	});

	const { data, isLoading, isFetching, error } = useQuery({
		queryKey: adminKeys.collections(filters),
		queryFn: () => fetchCollectionsList(filters),
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		if (error) {
			toast.error(error instanceof Error ? error.message : "获取合集列表出错");
		}
	}, [error]);

	const collections = data?.items ?? [];
	const total = Number(data?.total ?? 0);
	const pageCount = Math.max(1, Math.ceil(total / table.pageSize));

	useEffect(() => {
		if (table.page > pageCount) table.setPage(pageCount);
	}, [pageCount, table.page, table.setPage]);

	const pendingVars = usePendingMutationVars<{ collection?: AdminCollection }>(
		COLLECTIONS_MUTATION_KEY,
	);
	const pendingIds = new Set(
		pendingVars
			.map((vars) => vars.collection?.id)
			.filter((id): id is number => typeof id === "number"),
	);

	// 发布 / 下架：只改缓存里的 status
	const toggleStatus = useAdminMutation<
		unknown,
		{ collection: AdminCollection; status: string }
	>({
		mutationKey: COLLECTIONS_MUTATION_KEY,
		mutationFn: async ({ collection, status }) => {
			const res = await adminUpdateCollection({
				data: { id: collection.id, status },
			});
			if (!res?.success) throw new Error("更新合集状态失败");
			return res;
		},
		optimistic: (queryClient, { collection, status }) => {
			patchListItems<AdminCollection>(
				queryClient,
				adminKeys.collectionsRoot(),
				"items",
				(item) => (item.id === collection.id ? { ...item, status } : item),
			);
		},
		affects: invalidations.collections,
		successMessage: (_data, { status }) =>
			status === "published" ? "合集已发布" : "合集已下架",
	});

	const remove = useAdminMutation<unknown, { collection: AdminCollection }>({
		mutationKey: COLLECTIONS_MUTATION_KEY,
		mutationFn: async ({ collection }) => {
			const res = await adminDeleteCollection({ data: { id: collection.id } });
			if (!res?.success) throw new Error("删除合集失败");
			return res;
		},
		optimistic: (queryClient, { collection }) => {
			removeListItems<AdminCollection>(
				queryClient,
				adminKeys.collectionsRoot(),
				"items",
				(item) => item.id === collection.id,
			);
		},
		affects: invalidations.collections,
		successMessage: (_data, { collection }) =>
			`合集「${collection.title}」已删除`,
		onSuccess: () => setDeleteTarget(null),
	});

	const statusFilter: AdminFilter = {
		id: "status",
		label: "状态",
		value: statusFilterValue,
		onChange: (next) => {
			setStatusFilterValue(next);
			table.resetToFirstPage();
		},
		options: [
			{ value: "published", label: "已发布" },
			{ value: "hidden", label: "已隐藏" },
		],
	};

	const columns: AdminColumn<AdminCollection>[] = [
		{
			id: "title",
			header: "标题",
			mobile: "title",
			cell: (collection) => (
				<div className="flex gap-2.5 items-center min-w-0">
					{/* 列表接口不返回封面字段，这里用类型图标当缩略图占位 */}
					<IconTile
						icon={collection.type === "producer" ? Building2Icon : PackageIcon}
						size="sm"
						tone="muted"
					/>
					<div className="flex flex-col min-w-0">
						<Link
							to="/collections/$id"
							params={{ id: String(collection.id) }}
							target="_blank"
							className="inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
						>
							<span className="max-w-[16rem] truncate">{collection.title}</span>
							<ExternalLinkIcon className="shrink-0 size-3" />
						</Link>
						<span className="text-xs truncate text-muted-foreground">
							#{collection.id} · {collection.description?.trim() || "暂无简介"}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "status",
			header: "状态",
			mobile: "meta",
			cell: (collection) => {
				const meta = STATUS_META[collection.status] ?? {
					label: collection.status,
					tone: "neutral" as StatusTone,
				};
				return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
			},
		},
		{
			id: "entries",
			header: "游戏数",
			mobile: "meta",
			cell: (collection) => (
				<span className="text-sm tabular-nums">
					{collection.entryCount ?? collection.entries?.length ?? 0}
				</span>
			),
		},
		{
			id: "type",
			header: "类型",
			mobile: "meta",
			cell: (collection) => (
				<Badge variant="secondary">
					{TYPE_LABEL[collection.type] ?? collection.type}
				</Badge>
			),
		},
		{
			id: "updatedAt",
			header: "更新时间",
			mobile: "meta",
			cell: (collection) => (
				<span
					className="text-xs whitespace-nowrap text-muted-foreground"
					title={absoluteTime(collection.updatedAt)}
				>
					{formatRelativeTime(collection.updatedAt)}
				</span>
			),
		},
	];

	const visibleColumns = columns.filter(
		(column) => !table.hiddenColumns.includes(column.id),
	);
	const isFiltered = Boolean(statusFilterValue);

	return (
		<>
			<AdminDataTable
				columns={visibleColumns}
				rows={collections}
				getRowId={(collection) => String(collection.id)}
				isLoading={isLoading}
				isFetching={isFetching && !isLoading}
				skeletonRows={8}
				minWidth="min-w-[900px]"
				density={table.density}
				empty={{
					icon: PackageIcon,
					title: isFiltered ? "没有符合条件的合集" : "暂无合集数据",
					description: isFiltered
						? "换成其他状态筛选，或清空筛选后再看"
						: "新建一个合集，把相关的游戏整理到一起",
					action: !isFiltered ? (
						<Button variant="outline" size="sm" onClick={onCreate}>
							<PlusIcon className="size-4" />
							新建合集
						</Button>
					) : undefined,
				}}
				toolbar={
					<DataTableToolbar
						filters={[statusFilter]}
						isFiltered={isFiltered}
						onReset={() => {
							setStatusFilterValue("");
							table.resetToFirstPage();
						}}
						visibility={table.visibility}
						density={table.density}
						onDensityChange={table.setDensity}
					/>
				}
				footer={
					<DataTablePagination
						page={table.page}
						pageCount={pageCount}
						total={total}
						pageSize={table.pageSize}
						onPageChange={table.setPage}
						onPageSizeChange={table.setPageSize}
					/>
				}
				rowActions={(collection) => {
					const pending = pendingIds.has(collection.id);
					const nextStatus =
						collection.status === "published" ? "hidden" : "published";
					return (
						<>
							<Button
								variant="ghost"
								size="sm"
								disabled={pending}
								onClick={() =>
									toggleStatus.mutate({ collection, status: nextStatus })
								}
							>
								{pending ? (
									<Spinner className="size-4" />
								) : nextStatus === "published" ? (
									"发布"
								) : (
									"下架"
								)}
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="编辑合集"
								title="编辑合集"
								disabled={pending}
								onClick={() => setEditTarget(collection)}
							>
								<PencilIcon className="size-4" />
							</Button>
							<RowActionsMenu
								actions={[
									{
										label: "查看前台页面",
										icon: ExternalLinkIcon,
										onSelect: () => {
											window.open(
												`/collections/${collection.id}`,
												"_blank",
												"noopener,noreferrer",
											);
										},
									},
									{
										label: "删除合集",
										icon: Trash2Icon,
										variant: "destructive",
										separator: true,
										disabled: pending,
										onSelect: () => setDeleteTarget(collection),
									},
								]}
							/>
						</>
					);
				}}
			/>

			<EditCollectionDialog
				collection={editTarget}
				open={editTarget !== null}
				onOpenChange={(open) => {
					if (!open) setEditTarget(null);
				}}
			/>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				title="删除合集"
				desc="此操作将永久删除该合集及其所有条目，不可恢复。"
				destructive
				confirmText="确认删除"
				isLoading={remove.isPending}
				onConfirm={() => {
					if (deleteTarget) remove.mutate({ collection: deleteTarget });
				}}
			>
				<blockquote className="pl-3 text-sm italic text-muted-foreground border-l-2">
					{deleteTarget?.title}
				</blockquote>
			</ConfirmDialog>
		</>
	);
}

// ── 表单字段（新建 / 编辑共用） ───────────────────────────────

function CollectionFormFields({
	value,
	onChange,
}: {
	value: CollectionFormData;
	onChange: (next: CollectionFormData) => void;
}) {
	const toggleProducer = (pid: string) => {
		onChange({
			...value,
			producerIds: value.producerIds.includes(pid)
				? value.producerIds.filter((id) => id !== pid)
				: [...value.producerIds, pid],
		});
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="collection-title">合集名称</Label>
				<Input
					id="collection-title"
					value={value.title}
					onChange={(event) =>
						onChange({ ...value, title: event.target.value })
					}
					placeholder="输入合集名称"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="collection-description">简介</Label>
				<Textarea
					id="collection-description"
					value={value.description}
					onChange={(event) =>
						onChange({ ...value, description: event.target.value })
					}
					placeholder="输入合集简介（可选）"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="collection-type">类型</Label>
				<Select
					value={value.type}
					onValueChange={(next) =>
						onChange({ ...value, type: next ?? value.type })
					}
				>
					<SelectTrigger id="collection-type" className="w-full">
						<SelectValue placeholder="选择类型" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="manual">手动选择</SelectItem>
						<SelectItem value="producer">会社绑定</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{value.type === "producer" && (
				<ProducerSearch
					selectedIds={value.producerIds}
					onToggle={toggleProducer}
				/>
			)}

			{value.type === "manual" && (
				<GameSearch
					selectedVids={value.entries.map((entry) => entry.vid)}
					onAdd={(vid) =>
						onChange({
							...value,
							entries: [
								...value.entries,
								{ vid, sortOrder: value.entries.length },
							],
						})
					}
					onRemove={(vid) =>
						onChange({
							...value,
							entries: value.entries.filter((entry) => entry.vid !== vid),
						})
					}
				/>
			)}

			<div className="space-y-2">
				<Label htmlFor="collection-status">状态</Label>
				<Select
					value={value.status}
					onValueChange={(next) =>
						onChange({ ...value, status: next ?? value.status })
					}
				>
					<SelectTrigger id="collection-status" className="w-full">
						<SelectValue placeholder="选择状态" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="published">已发布</SelectItem>
						<SelectItem value="hidden">已隐藏</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}

// ── 会社搜索 ──────────────────────────────────────────────────

interface Producer {
	id: string;
	name: string;
	latin: string;
}

interface ProducerSearchProps {
	selectedIds: string[];
	onToggle: (pid: string) => void;
}

function ProducerSearch({ selectedIds, onToggle }: ProducerSearchProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Producer[]>([]);
	const [searching, setSearching] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const doSearch = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		setSearching(true);
		try {
			const res = await adminSearchProducers({
				data: { q: q.trim(), limit: 20 },
			});
			setResults((res ?? []) as Producer[]);
		} catch {
			setResults([]);
		} finally {
			setSearching(false);
		}
	}, []);

	const handleInput = (value: string) => {
		setQuery(value);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => doSearch(value), 300);
	};

	return (
		<div className="space-y-2">
			<Label>绑定会社</Label>
			{selectedIds.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-2">
					{selectedIds.map((pid) => (
						<Badge key={pid} variant="secondary" className="gap-1">
							{pid}
							<button
								type="button"
								aria-label={`移除会社 ${pid}`}
								onClick={() => onToggle(pid)}
								className="ml-1 rounded transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
							>
								<XIcon className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			<SearchField
				value={query}
				onChange={handleInput}
				placeholder="搜索会社名称或输入 ID（如 p123）"
				ariaLabel="搜索会社"
			/>
			{(results.length > 0 || searching) && (
				<div className="overflow-y-auto max-h-40 rounded-xl divide-y ring-1 ring-border/60">
					{searching && results.length === 0 && (
						<div className="flex justify-center items-center py-4">
							<Spinner className="size-4 text-muted-foreground" />
						</div>
					)}
					{results.map((producer) => (
						<label
							key={producer.id}
							className="flex gap-2 items-center px-3 py-2 transition-colors cursor-pointer hover:bg-muted/40"
						>
							<input
								type="checkbox"
								checked={selectedIds.includes(producer.id)}
								onChange={() => onToggle(producer.id)}
								className="size-4"
							/>
							<div className="flex-1 min-w-0">
								<span className="block text-sm truncate">{producer.name}</span>
								{producer.latin && (
									<span className="block text-xs text-muted-foreground truncate">
										{producer.latin}
									</span>
								)}
							</div>
							<span className="shrink-0 font-mono text-xs text-muted-foreground">
								{producer.id}
							</span>
						</label>
					))}
				</div>
			)}
		</div>
	);
}

// ── 游戏搜索 ──────────────────────────────────────────────────

interface GameInfo {
	id: string;
	alias: string | null;
	title: string | null;
	olang: string | null;
	titles_obj?: Array<{ lang: string; title: string; latin?: string }>;
}

function GameSearch({
	selectedVids,
	onAdd,
	onRemove,
}: {
	selectedVids: string[];
	onAdd: (vid: string) => void;
	onRemove: (vid: string) => void;
}) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GameInfo[]>([]);
	const [searching, setSearching] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const doSearch = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		setSearching(true);
		try {
			const res = await adminSearchGames({ data: { q: q.trim(), limit: 20 } });
			const games = (res ?? []) as unknown as GameInfo[];
			// 展示标题：中文优先（zh-Hans → zh → zh-Hant → 其它中文变体），无中文回退 olang
			setResults(
				games.map((game) => ({
					...game,
					title: preferredTitleFrom(game.titles_obj, game.olang) ?? null,
				})),
			);
		} catch {
			setResults([]);
		} finally {
			setSearching(false);
		}
	}, []);

	const handleInput = (value: string) => {
		setQuery(value);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => doSearch(value), 300);
	};

	return (
		<div className="space-y-2">
			<Label>游戏条目（VID）</Label>
			{selectedVids.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-2">
					{selectedVids.map((vid) => (
						<Badge key={vid} variant="secondary" className="gap-1">
							{vid}
							<button
								type="button"
								aria-label={`移除游戏 ${vid}`}
								onClick={() => onRemove(vid)}
								className="ml-1 rounded transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
							>
								<XIcon className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			<SearchField
				value={query}
				onChange={handleInput}
				placeholder="搜索游戏名称或输入 VID（如 v12345）"
				ariaLabel="搜索游戏"
			/>
			{(results.length > 0 || searching) && (
				<div className="overflow-y-auto max-h-40 rounded-xl divide-y ring-1 ring-border/60">
					{searching && results.length === 0 && (
						<div className="flex justify-center items-center py-4">
							<Spinner className="size-4 text-muted-foreground" />
						</div>
					)}
					{results.map((game) => (
						<button
							key={game.id}
							type="button"
							className="flex gap-2 items-center px-3 py-2 w-full text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
							disabled={selectedVids.includes(game.id)}
							onClick={() => {
								if (!selectedVids.includes(game.id)) {
									onAdd(game.id);
									setQuery("");
									setResults([]);
								}
							}}
						>
							<div className="flex-1 min-w-0">
								<span className="block text-sm truncate">
									{game.title || game.alias || game.id}
								</span>
							</div>
							<span className="shrink-0 font-mono text-xs text-muted-foreground">
								{game.id}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

// ── 新建合集 ──────────────────────────────────────────────────

function CreateCollectionDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<CollectionFormData>(emptyCollectionForm);

	const mutation = useAdminMutation<
		{ collection: AdminCollection } | null,
		CollectionFormData
	>({
		mutationKey: COLLECTIONS_MUTATION_KEY,
		mutationFn: async (values) => {
			const res = await adminCreateCollection({
				data: {
					title: values.title,
					description: values.description || undefined,
					type: values.type,
					producerIds:
						values.type === "producer" ? values.producerIds : undefined,
					status: values.status,
				},
			});
			if (!res?.success || !res.collection) {
				throw new Error("创建合集失败");
			}

			// 手动合集：紧接着写入条目（任一步失败都整体回滚）
			if (values.type === "manual" && values.entries.length > 0) {
				const entriesRes = await adminUpdateCollectionEntries({
					data: {
						id: res.collection.id,
						entries: values.entries.map((entry, index) => ({
							vid: entry.vid,
							sortOrder: index,
						})),
					},
				});
				if (!entriesRes?.success) throw new Error("创建条目失败");
			}

			return {
				collection: res.collection as unknown as AdminCollection,
			};
		},
		affects: invalidations.collections,
		successMessage: "合集已创建",
		onSuccess: (data, values) => {
			if (data?.collection) {
				// 提交成功后先插入缓存，列表立即出现新行
				prependListItem<AdminCollection>(
					queryClient,
					adminKeys.collectionsRoot(),
					"items",
					{
						...data.collection,
						description: values.description || null,
						entryCount:
							values.type === "manual"
								? values.entries.length
								: data.collection.entryCount,
						entries: values.entries,
					},
				);
			}
			setForm(emptyCollectionForm());
			onOpenChange(false);
		},
	});

	const handleSubmit = () => {
		if (!form.title.trim()) {
			toast.error("请输入合集名称");
			return;
		}
		mutation.mutate({ ...form, title: form.title.trim() });
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setForm(emptyCollectionForm());
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>新建合集</DialogTitle>
					<DialogDescription>
						创建一个新的游戏合集，可以是手动选择游戏或绑定会社
					</DialogDescription>
				</DialogHeader>

				<CollectionFormFields value={form} onChange={setForm} />

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						取消
					</Button>
					<Button onClick={handleSubmit} disabled={mutation.isPending}>
						{mutation.isPending && <Spinner className="size-4" />}
						创建
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ── 编辑合集 ──────────────────────────────────────────────────

function EditCollectionDialog({
	collection,
	open,
	onOpenChange,
}: {
	collection: AdminCollection | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [form, setForm] = useState<CollectionFormData>(emptyCollectionForm);

	useEffect(() => {
		if (open && collection) setForm(formFromCollection(collection));
	}, [open, collection]);

	const mutation = useAdminMutation<
		{ success: boolean },
		{ collection: AdminCollection; values: CollectionFormData }
	>({
		mutationKey: COLLECTIONS_MUTATION_KEY,
		mutationFn: async ({ collection: target, values }) => {
			const res = await adminUpdateCollection({
				data: {
					id: target.id,
					title: values.title,
					description: values.description || undefined,
					type: values.type,
					producerIds:
						values.type === "producer" ? values.producerIds : undefined,
					status: values.status,
				},
			});
			if (!res?.success) throw new Error("更新合集失败");

			if (values.type === "manual" && values.entries.length > 0) {
				const entriesRes = await adminUpdateCollectionEntries({
					data: {
						id: target.id,
						entries: values.entries.map((entry, index) => ({
							vid: entry.vid,
							sortOrder: index,
						})),
					},
				});
				if (!entriesRes?.success) throw new Error("更新条目失败");
			}

			return { success: true };
		},
		optimistic: (queryClient, { collection: target, values }) => {
			patchListItems<AdminCollection>(
				queryClient,
				adminKeys.collectionsRoot(),
				"items",
				(item) =>
					item.id === target.id
						? {
								...item,
								title: values.title,
								description: values.description || null,
								type: values.type,
								status: values.status,
								producerIds: values.producerIds,
								entries: values.entries,
								entryCount:
									values.type === "manual"
										? values.entries.length
										: item.entryCount,
							}
						: item,
			);
		},
		affects: invalidations.collections,
		successMessage: "合集已更新",
		onSuccess: () => onOpenChange(false),
	});

	if (!collection) return null;

	const handleSubmit = () => {
		if (!form.title.trim()) {
			toast.error("请输入合集名称");
			return;
		}
		mutation.mutate({
			collection,
			values: { ...form, title: form.title.trim() },
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>编辑合集</DialogTitle>
					<DialogDescription>
						修改「{collection.title}」的信息和条目
					</DialogDescription>
				</DialogHeader>

				<CollectionFormFields value={form} onChange={setForm} />

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						取消
					</Button>
					<Button onClick={handleSubmit} disabled={mutation.isPending}>
						{mutation.isPending && <Spinner className="size-4" />}
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
