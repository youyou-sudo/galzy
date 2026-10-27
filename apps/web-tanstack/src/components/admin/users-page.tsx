import {
	keepPreviousData,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { StatusPill } from "@web/components/admin/admin-table";
import { ConfirmDialog } from "@web/components/admin/confirm-dialog";
import {
	type AdminColumn,
	AdminDataTable,
	type AdminFilter,
	DataTablePagination,
	DataTableToolbar,
	RowActionsMenu,
} from "@web/components/admin/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
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
import { authClient } from "@web/server/auth/auth-client";
import {
	BanIcon,
	CircleCheckIcon,
	CopyIcon,
	LockIcon,
	PlusIcon,
	ShieldIcon,
	Trash2Icon,
	UserIcon,
	UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * 用户管理页。
 *
 * 数据来自 Better Auth 的 admin 插件（listUsers + setRole / banUser / …），
 * 所有写操作走「先改缓存、失败回滚」的乐观更新：封禁、解封、改角色、删除
 * 都不会整表转圈，也不会把搜索词 / 页码打回第一页。
 */

// ── 类型 ──────────────────────────────────────────────────────

export type AdminUser = {
	id: string;
	name: string;
	email: string;
	emailVerified?: boolean;
	image?: string | null;
	role?: string;
	banned?: boolean;
	banReason?: string | null;
	banExpires?: string | Date | null;
	createdAt: string | Date;
	updatedAt?: string | Date;
};

export type AdminUsersListResponse = {
	users: AdminUser[];
	total: number;
	limit?: number;
	offset?: number;
};

/** 列表查询条件：既是 query key 的组成，也是请求参数。 */
export type UsersListFilters = {
	searchValue: string;
	offset: number;
	limit: number;
	/** "" | "active" | "banned" */
	status: string;
};

export const USERS_PAGE_SIZE = 15;

/** 路由预取与组件内 useQuery 共用同一构造，避免首屏闪一次空列表。 */
export function usersListFilters(
	input: Partial<UsersListFilters> = {},
): UsersListFilters {
	return {
		searchValue: input.searchValue ?? "",
		offset: input.offset ?? 0,
		limit: input.limit ?? USERS_PAGE_SIZE,
		status: input.status ?? "",
	};
}

/** Better Auth 的 listUsers 只支持单条 filter 条件，这里把状态映射成 banned 等值过滤。 */
function bannedCondition(status: string) {
	if (status === "banned") {
		return {
			filterField: "banned",
			filterOperator: "eq" as const,
			filterValue: true,
		};
	}
	if (status === "active") {
		return {
			filterField: "banned",
			filterOperator: "eq" as const,
			filterValue: false,
		};
	}
	return {};
}

export async function fetchUsersList(
	filters: UsersListFilters,
): Promise<AdminUsersListResponse> {
	const res = await authClient.admin.listUsers({
		query: {
			limit: filters.limit,
			offset: filters.offset,
			searchValue: filters.searchValue || undefined,
			searchField: "email",
			searchOperator: "contains",
			sortBy: "createdAt",
			sortDirection: "desc",
			...bannedCondition(filters.status),
		},
	});
	if (res.error) {
		throw new Error(res.error.message || "获取用户列表失败");
	}
	return (res.data ?? {
		users: [],
		total: 0,
	}) as unknown as AdminUsersListResponse;
}

// ── 常量 ──────────────────────────────────────────────────────

/** 同一页面所有用户写操作共用一个 mutationKey，便于按行追踪 pending。 */
const USERS_MUTATION_KEY = ["admin", "users", "mutate"] as const;

const COLUMN_META = [
	{ id: "user", label: "用户" },
	{ id: "role", label: "角色" },
	{ id: "status", label: "封禁状态" },
	{ id: "createdAt", label: "注册时间" },
];

const ROLE_LABEL: Record<string, string> = {
	admin: "管理员",
	user: "普通用户",
};

function userName(user: AdminUser): string {
	return user.name || user.email || "未命名用户";
}

function absoluteTime(value: string | Date | null | undefined): string {
	if (!value) return "-";
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN");
}

// ── 页面 ──────────────────────────────────────────────────────

export default function UsersPage() {
	const [createOpen, setCreateOpen] = useState(false);

	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={UsersIcon}
				eyebrow="系统"
				title="用户管理"
				description="管理用户账号、角色、封禁与权限"
				actions={
					<Button onClick={() => setCreateOpen(true)}>
						<PlusIcon className="size-4" />
						创建用户
					</Button>
				}
			/>

			<UsersTable onCreate={() => setCreateOpen(true)} />

			<CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
		</div>
	);
}

// ── 列表 ──────────────────────────────────────────────────────

function UsersTable({ onCreate }: { onCreate: () => void }) {
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("");
	const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
	const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
	const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

	const table = useAdminTableState({
		storageKey: "users",
		defaultPageSize: USERS_PAGE_SIZE,
		columns: COLUMN_META,
	});

	const filters = usersListFilters({
		searchValue: search,
		offset: (table.page - 1) * table.pageSize,
		limit: table.pageSize,
		status,
	});

	const { data, isLoading, isFetching, error } = useQuery({
		queryKey: adminKeys.users(filters),
		queryFn: () => fetchUsersList(filters),
		// 翻页 / 筛选时保留上一页行，只压暗不闪骨架
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		if (error) {
			toast.error(error instanceof Error ? error.message : "获取用户列表出错");
		}
	}, [error]);

	const users = data?.users ?? [];
	const total = Number(data?.total ?? 0);
	const pageCount = Math.max(1, Math.ceil(total / table.pageSize));

	// 删除最后一条后页码可能越界，自动回落到最后一页
	useEffect(() => {
		if (table.page > pageCount) table.setPage(pageCount);
	}, [pageCount, table.page, table.setPage]);

	const pendingVars = usePendingMutationVars<{ user?: AdminUser }>(
		USERS_MUTATION_KEY,
	);
	const pendingUserIds = new Set(
		pendingVars
			.map((vars) => vars.user?.id)
			.filter((id): id is string => Boolean(id)),
	);

	const unban = useAdminMutation<unknown, { user: AdminUser }>({
		mutationKey: USERS_MUTATION_KEY,
		mutationFn: async ({ user }) => {
			const res = await authClient.admin.unbanUser({ userId: user.id });
			if (res.error) throw new Error(res.error.message || "解除封禁失败");
			return res.data;
		},
		optimistic: (queryClient, { user }) => {
			patchListItems<AdminUser>(
				queryClient,
				adminKeys.usersRoot(),
				"users",
				(item) =>
					item.id === user.id
						? { ...item, banned: false, banReason: null, banExpires: null }
						: item,
			);
		},
		affects: invalidations.users,
		successMessage: (_data, { user }) => `${userName(user)} 已解除封禁`,
	});

	const applySearch = (value: string) => {
		setSearch(value.trim());
		table.resetToFirstPage();
	};

	const statusFilter: AdminFilter = {
		id: "status",
		label: "状态",
		value: status,
		onChange: (next) => {
			setStatus(next);
			table.resetToFirstPage();
		},
		options: [
			{
				value: "active",
				label: "正常",
				icon: <CircleCheckIcon className="size-3.5 text-success" />,
			},
			{
				value: "banned",
				label: "已封禁",
				icon: <BanIcon className="size-3.5 text-destructive" />,
			},
		],
	};

	const columns: AdminColumn<AdminUser>[] = [
		{
			id: "user",
			header: "用户",
			mobile: "title",
			cell: (user) => (
				<div className="flex gap-2.5 items-center min-w-0">
					<Avatar className="size-8 shrink-0">
						{user.image ? <AvatarImage src={user.image} alt="" /> : null}
						<AvatarFallback className="text-xs">
							{user.name ? (
								user.name.slice(0, 1)
							) : (
								<UserIcon className="size-3.5" />
							)}
						</AvatarFallback>
					</Avatar>
					<div className="flex flex-col min-w-0">
						<span className="text-sm font-medium truncate">
							{user.name || "未命名用户"}
						</span>
						<span className="text-xs break-all text-muted-foreground">
							{user.email}
						</span>
					</div>
				</div>
			),
		},
		{
			id: "role",
			header: "角色",
			mobile: "meta",
			cell: (user) => (
				<Badge variant={user.role === "admin" ? "default" : "secondary"}>
					{ROLE_LABEL[user.role ?? "user"] ?? user.role}
				</Badge>
			),
		},
		{
			id: "status",
			header: "封禁状态",
			mobile: "meta",
			cell: (user) =>
				user.banned ? (
					<span title={user.banReason ?? "未填写封禁原因"}>
						<StatusPill tone="destructive" icon={BanIcon}>
							已封禁
						</StatusPill>
					</span>
				) : (
					<StatusPill tone="success" icon={CircleCheckIcon}>
						正常
					</StatusPill>
				),
		},
		{
			id: "createdAt",
			header: "注册时间",
			mobile: "meta",
			cell: (user) => (
				<span
					className="text-xs whitespace-nowrap text-muted-foreground"
					title={absoluteTime(user.createdAt)}
				>
					{formatRelativeTime(user.createdAt)}
				</span>
			),
		},
	];

	const visibleColumns = columns.filter(
		(column) => !table.hiddenColumns.includes(column.id),
	);

	const isFiltered = Boolean(search) || Boolean(status);

	return (
		<>
			<AdminDataTable
				columns={visibleColumns}
				rows={users}
				getRowId={(user) => user.id}
				isLoading={isLoading}
				isFetching={isFetching && !isLoading}
				skeletonRows={8}
				minWidth="min-w-[860px]"
				density={table.density}
				getRowClassName={(user) =>
					user.banned ? "bg-destructive/[0.03]" : undefined
				}
				empty={{
					icon: UsersIcon,
					title: isFiltered ? "没有匹配的用户" : "暂无用户数据",
					description: isFiltered
						? "换个关键词或状态筛选，再看看"
						: "创建第一个用户账号，或等待用户注册",
					action: !isFiltered ? (
						<Button variant="outline" size="sm" onClick={onCreate}>
							<PlusIcon className="size-4" />
							创建用户
						</Button>
					) : undefined,
				}}
				toolbar={
					<DataTableToolbar
						search={{
							value: searchInput,
							onChange: (value) => {
								setSearchInput(value);
								// 清除搜索立即复位，不必再按一次回车
								if (!value) applySearch("");
							},
							onSubmit: applySearch,
							placeholder: "搜索用户邮箱…",
							ariaLabel: "搜索用户邮箱",
						}}
						filters={[statusFilter]}
						isFiltered={isFiltered}
						onReset={() => {
							setSearchInput("");
							setSearch("");
							setStatus("");
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
				rowActions={(user) => {
					const pending = pendingUserIds.has(user.id);
					return (
						<>
							{user.banned ? (
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="解除封禁"
									title="解除封禁"
									disabled={pending}
									onClick={() => unban.mutate({ user })}
								>
									{pending ? (
										<Spinner className="size-4" />
									) : (
										<CircleCheckIcon className="size-4 text-success" />
									)}
								</Button>
							) : (
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="封禁用户"
									title="封禁用户"
									disabled={pending}
									onClick={() => setBanTarget(user)}
								>
									<BanIcon className="size-4 text-destructive" />
								</Button>
							)}
							<RowActionsMenu
								actions={[
									{
										label: "设置角色",
										icon: ShieldIcon,
										disabled: pending,
										onSelect: () => setRoleTarget(user),
									},
									{
										label: "更改密码",
										icon: LockIcon,
										disabled: pending,
										onSelect: () => setPasswordTarget(user),
									},
									{
										label: "删除用户",
										icon: Trash2Icon,
										variant: "destructive",
										separator: true,
										disabled: pending,
										onSelect: () => setDeleteTarget(user),
									},
								]}
							/>
						</>
					);
				}}
			/>

			<SetRoleDialog
				user={roleTarget}
				open={roleTarget !== null}
				onOpenChange={(open) => {
					if (!open) setRoleTarget(null);
				}}
			/>
			<SetPasswordDialog
				user={passwordTarget}
				open={passwordTarget !== null}
				onOpenChange={(open) => {
					if (!open) setPasswordTarget(null);
				}}
			/>
			<BanUserDialog
				user={banTarget}
				open={banTarget !== null}
				onOpenChange={(open) => {
					if (!open) setBanTarget(null);
				}}
			/>
			<DeleteUserDialog
				user={deleteTarget}
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			/>
		</>
	);
}

// ── 创建用户 ──────────────────────────────────────────────────

function CreateUserDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState("user");

	const reset = () => {
		setName("");
		setEmail("");
		setPassword("");
		setRole("user");
	};

	const mutation = useAdminMutation<
		{ user?: AdminUser } | null,
		{ name: string; email: string; password: string; role: string }
	>({
		mutationKey: USERS_MUTATION_KEY,
		mutationFn: async (values) => {
			const res = await authClient.admin.createUser({
				email: values.email,
				password: values.password,
				name: values.name,
				role: values.role as "user" | "admin",
			});
			if (res.error) throw new Error(res.error.message || "创建用户失败");
			return res.data as unknown as { user?: AdminUser } | null;
		},
		affects: invalidations.users,
		successMessage: "用户创建成功",
		onSuccess: (data) => {
			// 提交成功后先把新用户插进缓存，列表立即出现，再由失效校验真值
			if (data?.user) {
				prependListItem<AdminUser>(
					queryClient,
					adminKeys.usersRoot(),
					"users",
					data.user,
				);
			}
			reset();
			onOpenChange(false);
		},
	});

	const handleCreate = () => {
		if (mutation.isPending) return;
		if (!email.trim() || !password) {
			toast.error("邮箱和密码为必填项");
			return;
		}
		mutation.mutate({
			name: name.trim(),
			email: email.trim(),
			password,
			role,
		});
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>创建用户</DialogTitle>
					<DialogDescription>填写信息以创建新用户账号</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="c-name">用户名</Label>
						<Input
							id="c-name"
							placeholder="可选，留空则使用邮箱前缀"
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="c-email">邮箱 *</Label>
						<Input
							id="c-email"
							type="email"
							placeholder="user@example.com"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="c-password">密码 *</Label>
						<Input
							id="c-password"
							type="password"
							placeholder="至少 8 位字符"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") handleCreate();
							}}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="c-role">角色</Label>
						<Select
							value={role}
							onValueChange={(value) => setRole(value ?? "user")}
						>
							<SelectTrigger id="c-role">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="user">普通用户</SelectItem>
								<SelectItem value="admin">管理员</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						取消
					</Button>
					<Button onClick={handleCreate} disabled={mutation.isPending}>
						{mutation.isPending ? (
							<Spinner className="size-4" />
						) : (
							<PlusIcon className="size-4" />
						)}
						创建
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ── 设置角色 ──────────────────────────────────────────────────

function SetRoleDialog({
	user,
	open,
	onOpenChange,
}: {
	user: AdminUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [role, setRole] = useState("user");

	useEffect(() => {
		if (open && user) setRole(user.role || "user");
	}, [open, user?.id, user]);

	const mutation = useAdminMutation<unknown, { user: AdminUser; role: string }>(
		{
			mutationKey: USERS_MUTATION_KEY,
			mutationFn: async (values) => {
				const res = await authClient.admin.setRole({
					userId: values.user.id,
					role: values.role as "user" | "admin",
				});
				if (res.error) throw new Error(res.error.message || "设置角色失败");
				return res.data;
			},
			optimistic: (queryClient, values) => {
				patchListItems<AdminUser>(
					queryClient,
					adminKeys.usersRoot(),
					"users",
					(item) =>
						item.id === values.user.id ? { ...item, role: values.role } : item,
				);
			},
			affects: invalidations.users,
			successMessage: (_data, values) =>
				`已将 ${userName(values.user)} 设为 ${ROLE_LABEL[values.role] ?? values.role}`,
			onSuccess: () => onOpenChange(false),
		},
	);

	if (!user) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>设置用户角色</DialogTitle>
					<DialogDescription>
						为用户 <span className="font-medium">{userName(user)}</span>{" "}
						设置角色
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="sr-role">角色</Label>
					<Select
						value={role}
						onValueChange={(value) => setRole(value ?? "user")}
					>
						<SelectTrigger id="sr-role">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="user">普通用户</SelectItem>
							<SelectItem value="admin">管理员</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						取消
					</Button>
					<Button
						onClick={() => mutation.mutate({ user, role })}
						disabled={mutation.isPending}
					>
						{mutation.isPending && <Spinner className="size-4" />}
						确认
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ── 更改密码 ──────────────────────────────────────────────────

function SetPasswordDialog({
	user,
	open,
	onOpenChange,
}: {
	user: AdminUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [password, setPassword] = useState("");

	useEffect(() => {
		if (open) setPassword("");
	}, [open, user?.id]);

	const mutation = useAdminMutation<
		unknown,
		{ user: AdminUser; password: string }
	>({
		mutationKey: USERS_MUTATION_KEY,
		mutationFn: async (values) => {
			const res = await authClient.admin.setUserPassword({
				userId: values.user.id,
				newPassword: values.password,
			});
			if (res.error) throw new Error(res.error.message || "设置密码失败");
			return res.data;
		},
		// 密码不在列表里展示，无需改缓存，也不触发整表刷新
		affects: [],
		revalidate: false,
		successMessage: (_data, values) =>
			`已为 ${userName(values.user)} 设置新密码`,
		onSuccess: () => onOpenChange(false),
	});

	if (!user) return null;

	const submit = () => {
		if (mutation.isPending) return;
		if (password.length < 8) {
			toast.error("密码至少需要 8 位字符");
			return;
		}
		mutation.mutate({ user, password });
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>更改密码</DialogTitle>
					<DialogDescription>
						为用户 <span className="font-medium">{userName(user)}</span>{" "}
						设置新密码
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="sp-password">新密码</Label>
					<Input
						id="sp-password"
						type="password"
						placeholder="至少 8 位字符"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") submit();
						}}
					/>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={mutation.isPending}
					>
						取消
					</Button>
					<Button onClick={submit} disabled={mutation.isPending}>
						{mutation.isPending && <Spinner className="size-4" />}
						确认
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ── 封禁 ──────────────────────────────────────────────────────

function BanUserDialog({
	user,
	open,
	onOpenChange,
}: {
	user: AdminUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [reason, setReason] = useState("");
	const [expiresIn, setExpiresIn] = useState("");

	useEffect(() => {
		if (!open) {
			setReason("");
			setExpiresIn("");
		}
	}, [open]);

	const mutation = useAdminMutation<
		unknown,
		{ user: AdminUser; reason: string; expiresIn: string }
	>({
		mutationKey: USERS_MUTATION_KEY,
		mutationFn: async (values) => {
			const res = await authClient.admin.banUser({
				userId: values.user.id,
				banReason: values.reason || undefined,
				banExpiresIn: values.expiresIn ? Number(values.expiresIn) : undefined,
			});
			if (res.error) throw new Error(res.error.message || "封禁失败");
			return res.data;
		},
		optimistic: (queryClient, values) => {
			const expires = values.expiresIn
				? new Date(Date.now() + Number(values.expiresIn) * 1000)
				: null;
			patchListItems<AdminUser>(
				queryClient,
				adminKeys.usersRoot(),
				"users",
				(item) =>
					item.id === values.user.id
						? {
								...item,
								banned: true,
								banReason: values.reason || null,
								banExpires: expires,
							}
						: item,
			);
		},
		affects: invalidations.users,
		successMessage: (_data, values) => `${userName(values.user)} 已被封禁`,
		onSuccess: () => onOpenChange(false),
	});

	if (!user) return null;

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title="封禁用户"
			desc={
				<>
					封禁 <span className="font-medium">{userName(user)}</span>{" "}
					后该用户将无法登录，现有会话会被撤销。
				</>
			}
			destructive
			confirmText="确认封禁"
			isLoading={mutation.isPending}
			onConfirm={() => mutation.mutate({ user, reason, expiresIn })}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="ban-reason">封禁原因（可选）</Label>
					<Input
						id="ban-reason"
						placeholder="如：滥发垃圾信息"
						value={reason}
						onChange={(event) => setReason(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="ban-expires">封禁期限（秒，可选）</Label>
					<Input
						id="ban-expires"
						type="number"
						placeholder="留空则为永久封禁"
						value={expiresIn}
						onChange={(event) => setExpiresIn(event.target.value)}
					/>
					<p className="text-xs text-muted-foreground">
						常用：86400 = 1 天 · 604800 = 7 天 · 2592000 = 30 天
					</p>
				</div>
			</div>
		</ConfirmDialog>
	);
}

// ── 删除 ──────────────────────────────────────────────────────

function DeleteUserDialog({
	user,
	open,
	onOpenChange,
}: {
	user: AdminUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [confirmText, setConfirmText] = useState("");

	useEffect(() => {
		if (!open) setConfirmText("");
	}, [open]);

	const mutation = useAdminMutation<unknown, { user: AdminUser }>({
		mutationKey: USERS_MUTATION_KEY,
		mutationFn: async ({ user: target }) => {
			const res = await authClient.admin.removeUser({ userId: target.id });
			if (res.error) throw new Error(res.error.message || "删除用户失败");
			return res.data;
		},
		optimistic: (queryClient, { user: target }) => {
			removeListItems<AdminUser>(
				queryClient,
				adminKeys.usersRoot(),
				"users",
				(item) => item.id === target.id,
			);
		},
		affects: invalidations.users,
		successMessage: (_data, { user: target }) => `${userName(target)} 已被删除`,
		onSuccess: () => onOpenChange(false),
	});

	if (!user) return null;

	const matched = confirmText.trim() === user.email;

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title="删除用户"
			desc={
				<>
					此操作不可撤销。将永久删除用户{" "}
					<span className="font-medium">{userName(user)}</span> 的所有数据。
				</>
			}
			destructive
			confirmText="确认删除"
			isLoading={mutation.isPending}
			disabled={!matched}
			onConfirm={() => mutation.mutate({ user })}
		>
			<div className="space-y-2">
				<Label htmlFor="rm-confirm">
					请输入邮箱{" "}
					<span className="inline-flex gap-1 items-center">
						<span className="font-mono break-all text-destructive select-all">
							{user.email}
						</span>
						<button
							type="button"
							className="inline-flex justify-center items-center size-5 rounded transition-colors hover:bg-muted"
							aria-label="复制邮箱"
							onClick={() => {
								void navigator.clipboard.writeText(user.email);
								toast.success("已复制到剪贴板");
							}}
						>
							<CopyIcon className="size-3 text-muted-foreground" />
						</button>
					</span>{" "}
					以确认：
				</Label>
				<Input
					id="rm-confirm"
					placeholder={user.email}
					value={confirmText}
					onChange={(event) => setConfirmText(event.target.value)}
				/>
			</div>
		</ConfirmDialog>
	);
}
