import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	type QueryClient,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { TableCard } from "@web/components/admin/admin-table";
import { ConfirmDialog } from "@web/components/admin/confirm-dialog";
import { DataTableToolbar } from "@web/components/admin/data-table";
import { EmptyState } from "@web/components/shared/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Button } from "@web/components/ui/button";
import {
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import { Skeleton } from "@web/components/ui/skeleton";
import { Spinner } from "@web/components/ui/spinner";
import { Textarea } from "@web/components/ui/textarea";
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import {
	adminKeys,
	invalidations,
	publicKeys,
} from "@web/lib/admin/query-keys";
import type { FriendLink } from "@web/lib/friend-links";
import { cn } from "@web/lib/utils";
import {
	adminCreateFriendLink,
	adminDeleteFriendLink,
	adminGetFriendLinks,
	adminReorderFriendLinks,
	adminUpdateFriendLink,
} from "@web/server/admin/friend-links";
import {
	ExternalLinkIcon,
	GripVerticalIcon,
	HeartHandshakeIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * 友情链接管理页。
 *
 * 拖拽排序是核心交互，因此保留 @dnd-kit 的可排序行；排序结束后先改缓存
 * （后台列表 + 前台公开列表一起），再请求服务端，失败自动回滚到拖动前顺序。
 *
 * 说明：行列式布局与 AdminDataTable 同视觉，但用了 grid 行而不是 <table>，
 * 因为 dnd-kit 需要把 transform 挂到整行节点上（AdminDataTable 不暴露行组件）。
 */

// ── 常量 ──────────────────────────────────────────────────────

const FRIEND_LINKS_MUTATION_KEY = ["admin", "friend-links", "mutate"] as const;

const URL_PATTERN = /^https?:\/\/\S+$/i;

/** 链接列在桌面端的栅格：手柄 / 链接 / 描述 / 排序值 / 操作 */
const ROW_GRID =
	"sm:grid sm:grid-cols-[1.25rem_minmax(0,1.4fr)_minmax(0,1.2fr)_4rem_5.5rem] sm:items-center sm:gap-3";

interface FriendLinkFormValues {
	title: string;
	href: string;
	avatar: string;
	description: string;
}

const EMPTY_FORM: FriendLinkFormValues = {
	title: "",
	href: "",
	avatar: "",
	description: "",
};

/** 后台列表与前台列表共用一份缓存键语义，这里同时改两边的数组。 */
function updateFriendLinkCaches(
	queryClient: QueryClient,
	updater: (links: FriendLink[]) => FriendLink[],
): void {
	const admin = queryClient.getQueryData<FriendLink[]>(adminKeys.friendLinks());
	if (admin) {
		queryClient.setQueryData(adminKeys.friendLinks(), updater(admin));
	}
	const publicData = queryClient.getQueryData<FriendLink[]>(
		publicKeys.friendLinks,
	);
	if (publicData) {
		queryClient.setQueryData(publicKeys.friendLinks, updater(publicData));
	}
}

/** 拖动结束后的顺序：数组下标即新的 sortOrder。 */
function reorderLinks(links: FriendLink[], ids: number[]): FriendLink[] {
	const byId = new Map(links.map((link) => [link.id, link]));
	const ordered: FriendLink[] = [];
	for (const id of ids) {
		const link = byId.get(id);
		if (link) ordered.push(link);
	}
	for (const link of links) {
		if (!ids.includes(link.id)) ordered.push(link);
	}
	return ordered.map((link, index) => ({ ...link, sortOrder: index }));
}

// ── 页面 ──────────────────────────────────────────────────────

export default function FriendLinksAdminPage() {
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<FriendLink | null>(null);
	const [deleting, setDeleting] = useState<FriendLink | null>(null);

	const openCreate = () => {
		setEditing(null);
		setFormOpen(true);
	};

	const openEdit = (link: FriendLink) => {
		setEditing(link);
		setFormOpen(true);
	};

	return (
		<div className="flex flex-col">
			<AdminPageHeader
				icon={HeartHandshakeIcon}
				eyebrow="内容管理"
				title="友情链接"
				description="添加、删除与拖动排序，前台即时生效"
				actions={
					<Button onClick={openCreate}>
						<PlusIcon className="size-4" />
						新增友链
					</Button>
				}
			/>

			<FriendLinksList
				onCreate={openCreate}
				onEdit={openEdit}
				onDelete={(link) => setDeleting(link)}
			/>

			<FriendLinkFormDialog
				open={formOpen}
				onOpenChange={setFormOpen}
				link={editing}
			/>

			<DeleteFriendLinkDialog
				link={deleting}
				open={deleting !== null}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
			/>
		</div>
	);
}

// ── 列表 ──────────────────────────────────────────────────────

function FriendLinksList({
	onCreate,
	onEdit,
	onDelete,
}: {
	onCreate: () => void;
	onEdit: (link: FriendLink) => void;
	onDelete: (link: FriendLink) => void;
}) {
	// 拖动期间用本地顺序覆盖服务端顺序；乐观缓存追上后由 mutation 回调清空
	const [orderOverride, setOrderOverride] = useState<number[] | null>(null);

	const { data, isLoading, isFetching, isError, refetch } = useQuery({
		queryKey: adminKeys.friendLinks(),
		queryFn: async () => await adminGetFriendLinks({ data: {} }),
	});

	const byId = new Map((data ?? []).map((link) => [link.id, link]));
	const list = orderOverride
		? orderOverride
				.map((id) => byId.get(id))
				.filter((link): link is FriendLink => link !== undefined)
		: (data ?? []);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const reorder = useAdminMutation<{ success: boolean }, { ids: number[] }>({
		mutationKey: FRIEND_LINKS_MUTATION_KEY,
		mutationFn: async ({ ids }) => {
			const res = await adminReorderFriendLinks({ data: { ids } });
			if (!res?.success) throw new Error("保存排序失败");
			return res;
		},
		optimistic: (queryClient, { ids }) => {
			updateFriendLinkCaches(queryClient, (links) => reorderLinks(links, ids));
		},
		affects: invalidations.friendLinks,
		// 拖一次就弹一次 toast 太吵，失败时才提示
		successMessage: "",
		errorMessage: "保存排序失败，已恢复原顺序",
		onSuccess: () => setOrderOverride(null),
		onError: () => setOrderOverride(null),
	});

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = list.findIndex((item) => item.id === active.id);
		const newIndex = list.findIndex((item) => item.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const next = arrayMove(list, oldIndex, newIndex);
		// 先本地定序，避免松手到缓存更新之间闪回旧顺序
		setOrderOverride(next.map((item) => item.id));
		reorder.mutate({ ids: next.map((item) => item.id) });
	};

	const saving = reorder.isPending;

	return (
		<TableCard>
			<DataTableToolbar
				leading={
					<p className="text-xs text-muted-foreground">
						{isLoading
							? "正在加载…"
							: `共 ${list.length} 条 · 拖动左侧手柄调整前台展示顺序`}
					</p>
				}
				actions={
					saving ? (
						<span className="inline-flex gap-1.5 items-center text-xs text-muted-foreground">
							<Spinner className="size-3" />
							正在保存排序…
						</span>
					) : undefined
				}
			/>

			{/* 桌面端列头（移动端行内自解释，不重复表头） */}
			<div
				className={cn(
					"hidden px-4 py-2.5 text-xs font-medium text-muted-foreground border-b border-border/60 bg-[color:var(--table-header)]",
					ROW_GRID,
				)}
			>
				<span className="sr-only">拖拽排序</span>
				<span className="text-center">#</span>
				<span>名称</span>
				<span>描述</span>
				<span>排序值</span>
				<span className="text-right">操作</span>
			</div>

			{isLoading ? (
				<div className="flex flex-col">
					{Array.from({ length: 4 }).map((_, index) => (
						<FriendLinkRowSkeleton key={index} />
					))}
				</div>
			) : isError ? (
				<EmptyState
					icon={TriangleAlertIcon}
					title="列表加载失败"
					description="接口没有返回数据（网络或服务异常），不会影响已保存的友链，重试即可"
					size="sm"
					action={
						<Button variant="outline" size="sm" onClick={() => void refetch()}>
							重试
						</Button>
					}
				/>
			) : list.length === 0 ? (
				<EmptyState
					icon={HeartHandshakeIcon}
					title="暂无友链"
					description="添加第一位朋友，前台友情链接页会立即出现"
					size="sm"
					action={
						<Button variant="outline" size="sm" onClick={onCreate}>
							<PlusIcon className="size-4" />
							新增友链
						</Button>
					}
				/>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={list.map((item) => item.id)}
						strategy={verticalListSortingStrategy}
					>
						<div
							className={cn(
								"flex flex-col transition-opacity duration-200",
								isFetching && !isLoading && "opacity-60",
							)}
						>
							{list.map((link, index) => (
								<SortableFriendLinkRow
									key={link.id}
									link={link}
									index={index}
									disabled={saving}
									onEdit={onEdit}
									onDelete={onDelete}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</TableCard>
	);
}

// ── 骨架 ──────────────────────────────────────────────────────

function FriendLinkRowSkeleton() {
	return (
		<div
			aria-busy="true"
			className="flex gap-3 items-center px-4 py-3 border-b border-border/60 last:border-0"
		>
			<Skeleton className="size-4 rounded" />
			<Skeleton className="size-10 rounded-xl" />
			<div className="flex flex-col flex-1 gap-1.5">
				<Skeleton className="w-32 h-4" />
				<Skeleton className="w-48 h-3" />
			</div>
			<Skeleton className="size-8 rounded-lg" />
			<Skeleton className="size-8 rounded-lg" />
		</div>
	);
}

// ── 可拖拽行 ──────────────────────────────────────────────────

function SortableFriendLinkRow({
	link,
	index,
	disabled,
	onEdit,
	onDelete,
}: {
	link: FriendLink;
	index: number;
	disabled: boolean;
	onEdit: (link: FriendLink) => void;
	onDelete: (link: FriendLink) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: link.id, disabled });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 30 : undefined,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex flex-wrap gap-3 items-center px-4 py-3 bg-card border-b border-border/60 transition-colors duration-150 last:border-b-0 hover:bg-muted/40",
				ROW_GRID,
				isDragging && "relative z-30 shadow-md bg-muted/60",
			)}
		>
			<button
				ref={setActivatorNodeRef}
				type="button"
				{...attributes}
				{...listeners}
				aria-label={`拖拽排序 ${link.title}`}
				disabled={disabled}
				className="shrink-0 rounded text-muted-foreground cursor-grab touch-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed"
			>
				<GripVerticalIcon className="size-4" />
			</button>

			<div className="flex flex-1 gap-2.5 items-center min-w-0">
				<Avatar className="shrink-0 size-10 rounded-xl">
					{link.avatar ? (
						<AvatarImage src={link.avatar} alt={link.title} />
					) : null}
					<AvatarFallback className="text-xs rounded-xl bg-muted">
						{link.title.slice(0, 2)}
					</AvatarFallback>
				</Avatar>
				<div className="flex flex-col gap-0.5 min-w-0">
					<span className="text-sm font-medium truncate">{link.title}</span>
					<a
						href={link.href}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex gap-1 items-center max-w-full w-fit text-xs text-muted-foreground rounded transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					>
						<span className="truncate">{link.href}</span>
						<ExternalLinkIcon className="shrink-0 size-3" />
					</a>
				</div>
			</div>

			<p className="order-last w-full text-xs leading-relaxed line-clamp-2 text-muted-foreground sm:order-none sm:w-auto">
				{link.description?.trim() || "—"}
			</p>

			<span
				className="hidden text-xs tabular-nums text-muted-foreground sm:block"
				title={`前台展示顺序：第 ${index + 1} 位`}
			>
				{index + 1}
			</span>

			<div className="flex shrink-0 gap-1 items-center justify-end">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => onEdit(link)}
					aria-label={`编辑 ${link.title}`}
					title="编辑"
					className="text-muted-foreground hover:text-foreground"
				>
					<PencilIcon className="size-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => onDelete(link)}
					aria-label={`删除 ${link.title}`}
					title="删除"
					className="text-muted-foreground hover:text-destructive"
				>
					<Trash2Icon className="size-4" />
				</Button>
			</div>
		</div>
	);
}

// ── 新增 / 编辑 ───────────────────────────────────────────────

function FriendLinkFormDialog({
	open,
	onOpenChange,
	link,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	link: FriendLink | null;
}) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<FriendLinkFormValues>(EMPTY_FORM);
	const [errors, setErrors] = useState<{ title?: string; href?: string }>({});

	const isEdit = link !== null;

	// 每次打开都按当前编辑对象重置表单，避免残留上一次的输入
	useEffect(() => {
		if (!open) return;
		setForm({
			title: link?.title ?? "",
			href: link?.href ?? "",
			avatar: link?.avatar ?? "",
			description: link?.description ?? "",
		});
		setErrors({});
	}, [open, link]);

	const mutation = useAdminMutation<
		FriendLink | null,
		{ link: FriendLink | null; values: FriendLinkFormValues }
	>({
		mutationKey: FRIEND_LINKS_MUTATION_KEY,
		mutationFn: async ({ link: target, values }) => {
			const payload = {
				title: values.title.trim(),
				href: values.href.trim(),
				avatar: values.avatar.trim(),
				description: values.description.trim(),
			};
			if (target) {
				const updated = await adminUpdateFriendLink({
					data: { id: target.id, ...payload },
				});
				if (!updated) throw new Error("更新友链失败");
				return updated;
			}
			const created = await adminCreateFriendLink({ data: payload });
			if (!created) throw new Error("新增友链失败");
			return created;
		},
		optimistic: (queryClient, { link: target, values }) => {
			// 新建还没有 id，等提交成功后再插入缓存；编辑直接就地改
			if (!target) return;
			updateFriendLinkCaches(queryClient, (links) =>
				links.map((item) =>
					item.id === target.id
						? {
								...item,
								title: values.title.trim(),
								href: values.href.trim(),
								avatar: values.avatar.trim() || null,
								description: values.description.trim() || null,
							}
						: item,
				),
			);
		},
		affects: invalidations.friendLinks,
		successMessage: (_data, vars) => (vars.link ? "友链已更新" : "友链已新增"),
		onSuccess: (data, vars) => {
			if (!vars.link && data) {
				// 提交成功后插入缓存，列表立即出现新行（随后由失效校正真值）
				updateFriendLinkCaches(queryClient, (links) => [...links, data]);
			}
			onOpenChange(false);
		},
	});

	const validate = () => {
		const next: { title?: string; href?: string } = {};
		if (!form.title.trim()) next.title = "请填写标题";
		if (!form.href.trim()) {
			next.href = "请填写链接地址";
		} else if (!URL_PATTERN.test(form.href.trim())) {
			next.href = "链接需以 http:// 或 https:// 开头";
		}
		setErrors(next);
		return Object.keys(next).length === 0;
	};

	const handleSubmit = () => {
		if (mutation.isPending) return;
		if (!validate()) return;
		mutation.mutate({ link, values: form });
	};

	const setField = <K extends keyof FriendLinkFormValues>(
		key: K,
		value: FriendLinkFormValues[K],
	) => {
		setForm((previous) => ({ ...previous, [key]: value }));
	};

	const valid =
		Boolean(form.title.trim()) && URL_PATTERN.test(form.href.trim());

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title={isEdit ? "编辑友链" : "新增友链"}
			desc="标题与链接为必填项，图标与简介可留空"
			confirmText={isEdit ? "保存" : "创建"}
			isLoading={mutation.isPending}
			disabled={!valid}
			onConfirm={handleSubmit}
		>
			<div
				className="flex flex-col gap-4"
				onKeyDown={(event) => {
					if (
						event.key === "Enter" &&
						!(event.target instanceof HTMLTextAreaElement)
					) {
						event.preventDefault();
						handleSubmit();
					}
				}}
			>
				<Field>
					<FieldLabel htmlFor="friend-link-title">
						<FieldTitle>标题</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Input
							id="friend-link-title"
							value={form.title}
							onChange={(event) => setField("title", event.target.value)}
							placeholder="如：鲲 Galgame 论坛"
							maxLength={255}
							aria-invalid={errors.title ? true : undefined}
							aria-describedby={
								errors.title ? "friend-link-title-error" : undefined
							}
						/>
						<FieldError id="friend-link-title-error">{errors.title}</FieldError>
					</FieldContent>
				</Field>

				<Field>
					<FieldLabel htmlFor="friend-link-href">
						<FieldTitle>链接</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Input
							id="friend-link-href"
							value={form.href}
							onChange={(event) => setField("href", event.target.value)}
							placeholder="https://example.com"
							maxLength={2048}
							aria-invalid={errors.href ? true : undefined}
							aria-describedby={
								errors.href ? "friend-link-href-error" : undefined
							}
						/>
						<FieldError id="friend-link-href-error">{errors.href}</FieldError>
					</FieldContent>
				</Field>

				<Field>
					<FieldLabel htmlFor="friend-link-avatar">
						<FieldTitle>图标地址</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Input
							id="friend-link-avatar"
							value={form.avatar}
							onChange={(event) => setField("avatar", event.target.value)}
							placeholder="https://example.com/favicon.ico（可选）"
							maxLength={2048}
						/>
					</FieldContent>
				</Field>

				<Field>
					<FieldLabel htmlFor="friend-link-description">
						<FieldTitle>简介</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Textarea
							id="friend-link-description"
							value={form.description}
							onChange={(event) => setField("description", event.target.value)}
							placeholder="一句话介绍这位朋友（可选）"
							maxLength={2048}
							rows={3}
						/>
					</FieldContent>
				</Field>
			</div>
		</ConfirmDialog>
	);
}

// ── 删除 ──────────────────────────────────────────────────────

function DeleteFriendLinkDialog({
	link,
	open,
	onOpenChange,
}: {
	link: FriendLink | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const mutation = useAdminMutation<{ success: boolean }, { link: FriendLink }>(
		{
			mutationKey: FRIEND_LINKS_MUTATION_KEY,
			mutationFn: async ({ link: target }) => {
				const res = await adminDeleteFriendLink({ data: { id: target.id } });
				if (!res?.success) throw new Error("删除友链失败");
				return res;
			},
			optimistic: (queryClient, { link: target }) => {
				updateFriendLinkCaches(queryClient, (links) =>
					links.filter((item) => item.id !== target.id),
				);
			},
			affects: invalidations.friendLinks,
			successMessage: "友链已删除",
			onSuccess: () => onOpenChange(false),
		},
	);

	if (!link) return null;

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title="删除友情链接"
			desc={`确定要删除「${link.title}」吗？删除后前台将立即不再展示，且无法恢复。`}
			destructive
			confirmText="确认删除"
			isLoading={mutation.isPending}
			onConfirm={() => mutation.mutate({ link })}
		/>
	);
}
