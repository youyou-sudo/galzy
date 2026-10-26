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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { TableCard } from "@web/components/admin/admin-table";
import { EmptyState } from "@web/components/shared/empty-state";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@web/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
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
	Field,
	FieldContent,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import { Skeleton } from "@web/components/ui/skeleton";
import { Textarea } from "@web/components/ui/textarea";
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
	Loader2Icon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** 后台列表与前台共用一套数据源，改完两边一起失效。 */
const ADMIN_QUERY_KEY = ["admin-friend-links"] as const;
const PUBLIC_QUERY_KEY = ["friend-links"] as const;

const URL_PATTERN = /^https?:\/\/\S+$/i;

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

/** 写操作后让后台列表与前台列表同时过期，避免前台看到旧排序。 */
function useInvalidateFriendLinks() {
	const queryClient = useQueryClient();
	return async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEY }),
			queryClient.invalidateQueries({ queryKey: PUBLIC_QUERY_KEY }),
		]);
	};
}

export default function FriendLinksAdminPage() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<FriendLink | null>(null);

	const openCreate = () => {
		setEditing(null);
		setDialogOpen(true);
	};

	const openEdit = (link: FriendLink) => {
		setEditing(link);
		setDialogOpen(true);
	};

	return (
		<div className="flex flex-col gap-6">
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

			<FriendLinksList onEdit={openEdit} />

			<FriendLinkFormDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				link={editing}
			/>
		</div>
	);
}

function FriendLinksList({ onEdit }: { onEdit: (link: FriendLink) => void }) {
	const invalidate = useInvalidateFriendLinks();
	const [items, setItems] = useState<FriendLink[] | null>(null);
	const [savingOrder, setSavingOrder] = useState(false);

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ADMIN_QUERY_KEY,
		queryFn: async () => await adminGetFriendLinks({ data: {} }),
	});

	// 服务端数据变化（新增/删除/拖动后 invalidate）即同步本地乐观列表
	useEffect(() => {
		if (data) setItems(data);
	}, [data]);

	const list = items ?? data ?? [];

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = list.findIndex((item) => item.id === active.id);
		const newIndex = list.findIndex((item) => item.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const previous = list;
		const next = arrayMove(list, oldIndex, newIndex);
		setItems(next);
		setSavingOrder(true);
		try {
			await adminReorderFriendLinks({
				data: { ids: next.map((item) => item.id) },
			});
			await invalidate();
		} catch (err) {
			setItems(previous);
			toast.error(err instanceof Error ? err.message : "保存排序失败");
		} finally {
			setSavingOrder(false);
		}
	};

	return (
		<TableCard>
			<div className="flex flex-wrap gap-2 justify-between items-center px-4 py-3 border-b border-border/60">
				<p className="text-xs text-muted-foreground">
					{isLoading
						? "正在加载…"
						: `共 ${list.length} 条 · 拖动左侧手柄调整前台展示顺序`}
				</p>
				{savingOrder && (
					<span className="inline-flex gap-1.5 items-center text-xs text-muted-foreground">
						<Loader2Icon className="size-3 animate-spin" />
						正在保存排序…
					</span>
				)}
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
					description="点击右上角「新增友链」，添加第一位朋友吧"
					size="sm"
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
						<div className="flex flex-col divide-y divide-border/60">
							{list.map((link) => (
								<SortableFriendLinkRow
									key={link.id}
									link={link}
									disabled={savingOrder}
									onEdit={onEdit}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}
		</TableCard>
	);
}

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

function SortableFriendLinkRow({
	link,
	disabled,
	onEdit,
}: {
	link: FriendLink;
	disabled: boolean;
	onEdit: (link: FriendLink) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
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
				"flex gap-3 items-center px-4 py-3 bg-card transition-colors duration-200 hover:bg-muted/40",
				isDragging && "relative z-30 shadow-md bg-muted/60",
			)}
		>
			<button
				type="button"
				{...attributes}
				{...listeners}
				aria-label={`拖拽排序 ${link.title}`}
				disabled={disabled}
				className="shrink-0 rounded text-muted-foreground cursor-grab touch-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed"
			>
				<GripVerticalIcon className="size-4" />
			</button>

			<Avatar className="shrink-0 size-10 rounded-xl">
				{link.avatar ? (
					<AvatarImage src={link.avatar} alt={link.title} />
				) : null}
				<AvatarFallback className="text-xs rounded-xl bg-muted">
					{link.title.slice(0, 2)}
				</AvatarFallback>
			</Avatar>

			<div className="flex flex-col flex-1 gap-1 min-w-0">
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
				{link.description && (
					<span className="text-xs leading-relaxed line-clamp-2 text-muted-foreground">
						{link.description}
					</span>
				)}
			</div>

			<div className="flex shrink-0 gap-1.5 items-center">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => onEdit(link)}
					aria-label={`编辑 ${link.title}`}
					className="text-muted-foreground hover:text-foreground"
				>
					<PencilIcon className="size-4" />
				</Button>
				<DeleteFriendLinkDialog link={link} />
			</div>
		</div>
	);
}

function FriendLinkFormDialog({
	open,
	onOpenChange,
	link,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	link: FriendLink | null;
}) {
	const invalidate = useInvalidateFriendLinks();
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

	const mutation = useMutation({
		mutationFn: async (values: FriendLinkFormValues) => {
			const payload = {
				title: values.title.trim(),
				href: values.href.trim(),
				avatar: values.avatar.trim(),
				description: values.description.trim(),
			};
			if (link) {
				return await adminUpdateFriendLink({
					data: { id: link.id, ...payload },
				});
			}
			return await adminCreateFriendLink({ data: payload });
		},
		onSuccess: async () => {
			toast.success(isEdit ? "友链已更新" : "友链已新增");
			onOpenChange(false);
			await invalidate();
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "保存友链出错");
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
		if (!validate()) return;
		mutation.mutate(form);
	};

	const setField = <K extends keyof FriendLinkFormValues>(
		key: K,
		value: FriendLinkFormValues[K],
	) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEdit ? "编辑友链" : "新增友链"}</DialogTitle>
					<DialogDescription>
						标题与链接为必填项，图标与简介可留空
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<Field>
						<FieldLabel>
							<FieldTitle>标题</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								value={form.title}
								onChange={(e) => setField("title", e.target.value)}
								placeholder="如：鲲 Galgame 论坛"
								aria-invalid={errors.title ? true : undefined}
							/>
							<FieldError>{errors.title}</FieldError>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel>
							<FieldTitle>链接</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								value={form.href}
								onChange={(e) => setField("href", e.target.value)}
								placeholder="https://example.com"
								aria-invalid={errors.href ? true : undefined}
							/>
							<FieldError>{errors.href}</FieldError>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel>
							<FieldTitle>图标地址</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								value={form.avatar}
								onChange={(e) => setField("avatar", e.target.value)}
								placeholder="https://example.com/favicon.ico（可选）"
							/>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel>
							<FieldTitle>简介</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Textarea
								value={form.description}
								onChange={(e) => setField("description", e.target.value)}
								placeholder="一句话介绍这位朋友（可选）"
								rows={3}
							/>
						</FieldContent>
					</Field>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						取消
					</Button>
					<Button onClick={handleSubmit} disabled={mutation.isPending}>
						{mutation.isPending && (
							<Loader2Icon className="size-4 animate-spin" />
						)}
						{isEdit ? "保存" : "创建"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function DeleteFriendLinkDialog({ link }: { link: FriendLink }) {
	const invalidate = useInvalidateFriendLinks();
	const [open, setOpen] = useState(false);

	const mutation = useMutation({
		mutationFn: async () =>
			await adminDeleteFriendLink({ data: { id: link.id } }),
		onSuccess: async () => {
			toast.success("友链已删除");
			setOpen(false);
			await invalidate();
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "删除友链出错");
		},
	});

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						disabled={mutation.isPending}
						aria-label={`删除 ${link.title}`}
						className="text-muted-foreground hover:text-destructive"
					>
						<Trash2Icon className="size-4" />
					</Button>
				}
			/>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>删除友情链接</AlertDialogTitle>
					<AlertDialogDescription>
						确定要删除「{link.title}」吗？删除后前台将立即不再展示，且无法恢复。
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={mutation.isPending}>
						取消
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending}
						className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
					>
						{mutation.isPending && (
							<Loader2Icon className="size-4 animate-spin" />
						)}
						确认删除
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
