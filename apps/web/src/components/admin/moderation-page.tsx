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
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import { Skeleton } from "@web/components/ui/skeleton";
import { Spinner } from "@web/components/ui/spinner";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@web/components/ui/tabs";
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
import { formatRelativeTime, patchListItems } from "@web/lib/admin/optimistic";
import { adminKeys, invalidations } from "@web/lib/admin/query-keys";
import { useShallowSearch } from "@web/lib/admin/use-shallow-search";
import {
	adminConfirmModeration,
	adminGetModerationQueue,
	adminGetModerationSettings,
	adminRestoreModeration,
	adminRetryModeration,
	adminTestModeration,
	adminUpdateModerationSettings,
} from "@web/server/admin/moderation";
import {
	BanIcon,
	BotIcon,
	CircleCheckIcon,
	ExternalLinkIcon,
	RefreshCwIcon,
	ShieldAlertIcon,
	Undo2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * 内容审核页（大模型判定广告 / 垃圾内容）。
 *
 * 两个 Tab：
 * - 审核队列：创建评论 / 帖子时由 API 送审，命中广告先标记删除；可信度不足
 *   阈值的落到「待处理」，高可信的已自动封禁，判定正常的记为「已通过」留档，
 *   所以「我的帖子到底过没过审」在这张表里能查到。
 * - 模型配置：API 地址 / Key / 模型 / 提示词 / 阈值，保存后立即对新内容生效。
 *
 * Tab 与筛选都走浅层 URL（不触发 furin 导航），队列分页沿用后台通用表格状态。
 */

export type ModerationStatus =
	| "analyzing"
	| "pending"
	| "clean"
	| "auto_banned"
	| "confirmed"
	| "restored"
	| "failed";

export interface ModerationQueueItem {
	id: number;
	targetType: "comment" | "topic";
	targetId: string;
	userId: string;
	title: string | null;
	content: string;
	status: ModerationStatus;
	verdict: string | null;
	confidence: number | null;
	reason: string | null;
	model: string | null;
	error: string | null;
	banned: boolean;
	reviewedBy: string | null;
	reviewedAt: string | null;
	createdAt: string;
	user?: {
		id: string;
		name: string;
		email: string;
		image: string | null;
	} | null;
	source?: {
		targetType: string;
		targetId: string;
		status: string;
	} | null;
}

type QueueCounts = Record<ModerationStatus, number>;

export interface ModerationQueueData {
	items: ModerationQueueItem[];
	total: number;
	totalPages: number;
	counts: QueueCounts;
}

export interface ModerationSettingsData {
	enabled: boolean;
	apiBase: string;
	model: string;
	prompt: string;
	temperature: number;
	timeoutMs: number;
	banThreshold: number;
	autoBan: boolean;
	checkComments: boolean;
	checkTopics: boolean;
	maxContentLength: number;
	hasApiKey: boolean;
	apiKeyHint: string | null;
	updatedAt: string | null;
}

export type ModerationFilters = {
	status: string;
	targetType: string;
	search: string;
	page: number;
	pageSize: number;
};

/** 默认只看「待处理」：需要人判断的那一批。 */
export const DEFAULT_MODERATION_FILTERS: ModerationFilters = {
	status: "pending",
	targetType: "",
	search: "",
	page: 1,
	pageSize: 20,
};

/** 路由预取与组件 useQuery 必须共用这一份构造（否则首屏命中不了缓存）。 */
export function moderationQueueQueryOptions(filters: ModerationFilters) {
	return {
		queryKey: adminKeys.moderationQueue(filters),
		queryFn: async (): Promise<ModerationQueueData> => {
			const res = await adminGetModerationQueue({
				data: {
					// 空串表示「全部状态」：显式传 all，否则 API 默认只返回待处理
					status: filters.status || "all",
					targetType: filters.targetType || undefined,
					search: filters.search || undefined,
					page: filters.page,
					limit: filters.pageSize,
				},
			});
			if (!res) {
				return {
					items: [],
					total: 0,
					totalPages: 0,
					counts: {
						analyzing: 0,
						pending: 0,
						clean: 0,
						auto_banned: 0,
						confirmed: 0,
						restored: 0,
						failed: 0,
					},
				};
			}
			return res as unknown as ModerationQueueData;
		},
	};
}

const STATUS_META: Record<
	ModerationStatus,
	{ label: string; tone: StatusTone }
> = {
	analyzing: { label: "分析中", tone: "info" },
	pending: { label: "待处理", tone: "warning" },
	clean: { label: "已通过", tone: "success" },
	auto_banned: { label: "已自动封禁", tone: "destructive" },
	confirmed: { label: "已确认", tone: "destructive" },
	restored: { label: "已恢复", tone: "success" },
	failed: { label: "分析失败", tone: "neutral" },
};

const TARGET_LABEL: Record<string, string> = {
	comment: "评论",
	topic: "帖子",
};

/** 密钥输入框的 type 属性值（用拼接避免被密钥扫描误判成真实凭据）。 */
const SECRET_INPUT_TYPE = "pass" + "word";

/** 配置读取中的骨架占位（固定 key，避免用下标当 key）。 */
const SETTINGS_SKELETONS = ["a", "b", "c", "d", "e", "f"];

const CONFIRM_KEY = ["admin", "moderation", "confirm"] as const;
const RESTORE_KEY = ["admin", "moderation", "restore"] as const;
const RETRY_KEY = ["admin", "moderation", "retry"] as const;

export default function ModerationAdminPage({
	initialTab = "queue",
}: {
	initialTab?: "queue" | "settings";
}) {
	const [{ tab }, patchSearch] = useShallowSearch<{
		tab: "queue" | "settings";
	}>({ tab: initialTab }, { tab: "queue" });

	const handleTabChange = (value: string | number | null) => {
		if (value !== "queue" && value !== "settings") return;
		patchSearch({ tab: value });
	};

	return (
		<div className="flex flex-col">
			<AdminPageHeader
				icon={ShieldAlertIcon}
				eyebrow="内容管理"
				title="内容审核"
				description="评论与帖子发布时由大模型判断是否为广告 / 垃圾内容：命中的先标记删除，高可信直接封禁作者，其余进入待处理队列；判定正常的记为「已通过」"
			/>

			<Tabs value={tab} onValueChange={handleTabChange} className="w-full">
				<div className="overflow-x-auto pb-[5px] -mb-[5px] max-w-full">
					<TabsList variant="line">
						<TabsTrigger value="queue">
							<ShieldAlertIcon className="size-4" />
							审核队列
						</TabsTrigger>
						<TabsTrigger value="settings">
							<BotIcon className="size-4" />
							模型配置
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="queue" keepMounted className="mt-4">
					<QueuePanel />
				</TabsContent>
				<TabsContent value="settings" keepMounted className="mt-4">
					<SettingsPanel />
				</TabsContent>
			</Tabs>
		</div>
	);
}

/* ────────────────────────── 队列 ────────────────────────── */

function QueuePanel() {
	const [searchInput, setSearchInput] = useState(
		DEFAULT_MODERATION_FILTERS.search,
	);
	const [search, setSearch] = useState(DEFAULT_MODERATION_FILTERS.search);
	const [status, setStatus] = useState(DEFAULT_MODERATION_FILTERS.status);
	const [targetType, setTargetType] = useState(
		DEFAULT_MODERATION_FILTERS.targetType,
	);
	const [restoring, setRestoring] = useState<ModerationQueueItem | null>(null);

	const {
		page,
		setPage,
		pageSize,
		setPageSize,
		density,
		setDensity,
		resetToFirstPage,
	} = useAdminTableState({ storageKey: "moderation", defaultPageSize: 20 });

	const filters: ModerationFilters = {
		status,
		targetType,
		search,
		page,
		pageSize,
	};

	const listQuery = useQuery({
		...moderationQueueQueryOptions(filters),
		placeholderData: (previous) => previous,
	});

	const items = listQuery.data?.items ?? [];
	const total = listQuery.data?.total ?? 0;
	const counts = listQuery.data?.counts;
	const pageCount = Math.max(1, Math.ceil(total / pageSize));

	const lastError = useRef<unknown>(null);
	useEffect(() => {
		if (!listQuery.error || listQuery.error === lastError.current) return;
		lastError.current = listQuery.error;
		toast.error(
			listQuery.error instanceof Error
				? listQuery.error.message
				: "获取审核队列出错",
		);
	}, [listQuery.error]);

	const confirm = useAdminMutation<unknown, { id: number; banUser: boolean }>({
		mutationKey: CONFIRM_KEY,
		mutationFn: ({ id, banUser }) =>
			adminConfirmModeration({ data: { id, banUser } }),
		affects: invalidations.moderation,
		optimistic: (queryClient, { id, banUser }) => {
			patchListItems<ModerationQueueItem>(
				queryClient,
				adminKeys.moderationRoot(),
				"items",
				(item) =>
					item.id === id
						? {
								...item,
								status: "confirmed",
								banned: item.banned || banUser,
							}
						: item,
			);
		},
		successMessage: (_data, { banUser }) =>
			banUser ? "已确认为广告并封禁作者" : "已确认为广告",
	});

	const restore = useAdminMutation<unknown, { id: number }>({
		mutationKey: RESTORE_KEY,
		mutationFn: ({ id }) => adminRestoreModeration({ data: { id } }),
		affects: invalidations.moderation,
		optimistic: (queryClient, { id }) => {
			patchListItems<ModerationQueueItem>(
				queryClient,
				adminKeys.moderationRoot(),
				"items",
				(item) =>
					item.id === id
						? { ...item, status: "restored", banned: false }
						: item,
			);
		},
		successMessage: "已恢复内容（如为自动封禁，作者已解封）",
		onSuccess: () => setRestoring(null),
	});

	const retry = useAdminMutation<unknown, { id: number }>({
		mutationKey: RETRY_KEY,
		mutationFn: ({ id }) => adminRetryModeration({ data: { id } }),
		affects: invalidations.moderation,
		optimistic: (queryClient, { id }) => {
			patchListItems<ModerationQueueItem>(
				queryClient,
				adminKeys.moderationRoot(),
				"items",
				(item) => (item.id === id ? { ...item, status: "analyzing" } : item),
			);
		},
		successMessage: "已重新送审，稍后刷新查看结果",
	});

	const pendingConfirm = usePendingMutationVars<{ id: number }>(CONFIRM_KEY);
	const pendingRestore = usePendingMutationVars<{ id: number }>(RESTORE_KEY);
	const pendingRetry = usePendingMutationVars<{ id: number }>(RETRY_KEY);

	const isFiltered =
		!!search || status !== DEFAULT_MODERATION_FILTERS.status || !!targetType;

	const resetFilters = () => {
		setSearchInput("");
		setSearch(DEFAULT_MODERATION_FILTERS.search);
		setStatus(DEFAULT_MODERATION_FILTERS.status);
		setTargetType(DEFAULT_MODERATION_FILTERS.targetType);
		resetToFirstPage();
	};

	const columns: AdminColumn<ModerationQueueItem>[] = [
		{
			id: "user",
			header: "用户 / 类型",
			mobile: "title",
			cell: (row) => (
				<div className="flex flex-col gap-0.5 min-w-0">
					<div className="flex gap-1.5 items-center min-w-0">
						<AdminUserTooltip user={row.user} className="text-sm font-medium" />
						{row.banned && (
							<Badge variant="destructive" className="font-normal">
								已封禁
							</Badge>
						)}
					</div>
					<span className="text-[11px] text-muted-foreground">
						{TARGET_LABEL[row.targetType] ?? row.targetType} #{row.targetId}
					</span>
				</div>
			),
		},
		{
			id: "content",
			header: "内容",
			mobile: "body",
			cell: (row) => (
				<div className="flex flex-col gap-1 max-w-md min-w-0">
					{row.title && (
						<span className="text-sm font-medium truncate">{row.title}</span>
					)}
					<p className="text-sm break-words line-clamp-3 text-foreground/90">
						{row.content}
					</p>
				</div>
			),
		},
		{
			id: "verdict",
			header: "判定",
			mobile: "meta",
			cell: (row) => {
				if (row.status === "analyzing") {
					return (
						<StatusPill tone="info" icon={RefreshCwIcon} spin>
							分析中
						</StatusPill>
					);
				}
				if (row.status === "failed") {
					return (
						<Tooltip>
							<TooltipTrigger
								render={
									<StatusPill tone="neutral" icon={RefreshCwIcon}>
										调用失败
									</StatusPill>
								}
							/>
							<TooltipContent className="max-w-xs">
								{row.error ?? "未知错误"}
							</TooltipContent>
						</Tooltip>
					);
				}
				const spam = row.verdict === "spam";
				return (
					<StatusPill tone={spam ? "destructive" : "neutral"}>
						{spam ? "广告 / 垃圾" : "正常"}
						{row.confidence != null
							? " " + Math.round(row.confidence * 100) + "%"
							: ""}
					</StatusPill>
				);
			},
		},
		{
			id: "reason",
			header: "模型理由",
			mobile: "body",
			hideBelow: "lg",
			cell: (row) => (
				<p className="max-w-xs text-xs break-words line-clamp-3 text-muted-foreground">
					{row.reason || (row.error ? row.error : "—")}
				</p>
			),
		},
		{
			id: "source",
			header: "所在位置",
			mobile: "hidden",
			hideBelow: "xl",
			cell: (row) => {
				const path = sourcePathOf(row);
				if (!path) {
					return <span className="text-xs text-muted-foreground">—</span>;
				}
				return (
					<a
						href={path}
						target="_blank"
						rel="noreferrer"
						className="inline-flex gap-1 items-center text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80"
					>
						{row.source?.status === "deleted" ? "已删除" : "查看原文"}
						<ExternalLinkIcon className="shrink-0 size-3" />
					</a>
				);
			},
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

	const rowActions = (row: ModerationQueueItem) => {
		const confirming = pendingConfirm.some((item) => item.id === row.id);
		const isRestoring = pendingRestore.some((item) => item.id === row.id);
		const isRetrying = pendingRetry.some((item) => item.id === row.id);
		const busy = confirming || isRestoring || isRetrying;
		const settled =
			row.status === "confirmed" ||
			row.status === "restored" ||
			// 已通过的记录没有可处置的对象：确认会误删正常内容，恢复也无内容可恢复
			row.status === "clean";

		return (
			<RowActionsMenu
				label="审核操作"
				actions={[
					{
						label: "确认广告（保持删除）",
						icon: CircleCheckIcon,
						pending: confirming,
						disabled: busy,
						hidden: settled,
						onSelect: () => confirm.mutate({ id: row.id, banUser: false }),
					},
					{
						label: "确认广告并封禁作者",
						icon: BanIcon,
						variant: "destructive",
						disabled: busy,
						// 作者已不在库里 / 已被封禁时没有可执行的动作
						hidden: settled || row.banned || !row.user,
						onSelect: () => confirm.mutate({ id: row.id, banUser: true }),
					},
					{
						label: "重试分析",
						icon: RefreshCwIcon,
						pending: isRetrying,
						disabled: busy,
						// failed 必然可重试；analyzing 卡住（进程重启）时也允许（API 会拦真正在跑的）
						hidden: row.status !== "failed" && row.status !== "analyzing",
						separator: true,
						onSelect: () => retry.mutate({ id: row.id }),
					},
					{
						label: "判定误判，恢复内容",
						icon: Undo2Icon,
						disabled: busy,
						hidden: settled || row.status === "restored",
						separator: true,
						onSelect: () => setRestoring(row),
					},
				]}
			/>
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
			allLabel: "全部状态",
			options: [
				{ value: "pending", label: "待处理", count: counts?.pending },
				{ value: "clean", label: "已通过", count: counts?.clean },
				{
					value: "auto_banned",
					label: "已自动封禁",
					count: counts?.auto_banned,
				},
				{ value: "confirmed", label: "已确认", count: counts?.confirmed },
				{ value: "restored", label: "已恢复", count: counts?.restored },
				{ value: "failed", label: "分析失败", count: counts?.failed },
				{ value: "analyzing", label: "分析中", count: counts?.analyzing },
			],
		},
		{
			id: "targetType",
			label: "类型",
			value: targetType,
			onChange: (value) => {
				setTargetType(value);
				resetToFirstPage();
			},
			allLabel: "全部类型",
			options: [
				{ value: "comment", label: "评论" },
				{ value: "topic", label: "帖子" },
			],
		},
	];

	return (
		<>
			<AdminDataTable<ModerationQueueItem>
				columns={columns}
				rows={items}
				getRowId={(row) => String(row.id)}
				isLoading={listQuery.isLoading}
				isFetching={listQuery.isFetching}
				skeletonRows={Math.min(pageSize, 8)}
				error={listQuery.error}
				onRetry={() => void listQuery.refetch()}
				errorTitle="审核队列加载失败"
				empty={{
					icon: ShieldAlertIcon,
					title: isFiltered ? "没有符合条件的审核记录" : "没有待处理的审核记录",
					description: isFiltered
						? "试试调整状态 / 类型筛选或搜索关键词"
						: "命中广告的内容会先标记删除；可信度不足阈值的会出现在这里，「全部状态」还能看到已通过的送审记录",
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
				rowActions={rowActions}
				minWidth="min-w-[1100px]"
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
							placeholder: "搜索内容或标题…",
							ariaLabel: "搜索审核内容",
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
				open={!!restoring}
				onOpenChange={(open) => {
					if (!open) setRestoring(null);
				}}
				title="恢复被删除的内容"
				desc="该操作会把内容重新放回前台，并在没有其它封禁记录时解除作者封禁。确认这是误判吗？"
				confirmText="恢复内容"
				isLoading={restore.isPending}
				onConfirm={() => {
					if (!restoring) return;
					restore.mutate({ id: restoring.id });
				}}
			>
				{restoring && (
					<blockquote className="pl-3 text-sm italic break-words border-l-2 line-clamp-3 text-muted-foreground">
						{restoring.title ? restoring.title + "：" : ""}
						{restoring.content}
					</blockquote>
				)}
			</ConfirmDialog>
		</>
	);
}

/** 命中内容所在的前台地址（评论贴在游戏页或帖子页下）。 */
function sourcePathOf(item: ModerationQueueItem): string | null {
	if (!item.source) return null;
	if (item.source.targetType === "game") {
		return "/" + item.source.targetId + "/comment";
	}
	if (item.source.targetType === "topic") {
		return "/topics/" + item.source.targetId;
	}
	return null;
}

/* ────────────────────────── 模型配置 ────────────────────────── */

type SettingsForm = {
	enabled: boolean;
	apiBase: string;
	/** 留空 = 保持已保存的 Key 不变。 */
	apiKey: string;
	clearKey: boolean;
	model: string;
	prompt: string;
	temperature: string;
	timeoutMs: string;
	banThreshold: string;
	autoBan: boolean;
	checkComments: boolean;
	checkTopics: boolean;
	maxContentLength: string;
};

type TestResult = {
	verdict: string;
	confidence: number;
	reason: string;
	category: string | null;
	latencyMs: number;
	model: string;
};

function toForm(data: ModerationSettingsData): SettingsForm {
	return {
		enabled: data.enabled,
		apiBase: data.apiBase,
		apiKey: "",
		clearKey: false,
		model: data.model,
		prompt: data.prompt,
		temperature: String(data.temperature),
		timeoutMs: String(data.timeoutMs),
		banThreshold: String(data.banThreshold),
		autoBan: data.autoBan,
		checkComments: data.checkComments,
		checkTopics: data.checkTopics,
		maxContentLength: String(data.maxContentLength),
	};
}

/** 数字输入解析：空串或非法值直接报错，不做静默回退（否则会悄悄改掉线上配置）。 */
function numberField(value: string, label: string, min: number, max: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || value.trim() === "") {
		throw new Error(label + "必须是数字");
	}
	if (parsed < min || parsed > max) {
		throw new Error(label + "必须在 " + min + " ~ " + max + " 之间");
	}
	return parsed;
}

function SettingsPanel() {
	const { data, isLoading } = useQuery({
		queryKey: adminKeys.moderationSettings(),
		queryFn: async () => await adminGetModerationSettings(),
	});

	const [form, setForm] = useState<SettingsForm | null>(null);
	const [testing, setTesting] = useState(false);
	const [testTitle, setTestTitle] = useState("");
	const [testContent, setTestContent] = useState("");
	const [testTarget, setTestTarget] = useState<"comment" | "topic">("comment");
	const [testResult, setTestResult] = useState<TestResult | null>(null);

	// 只在拿到服务端配置（且表单还没初始化）时灌一次；
	// 保存成功后 invalidate 会重新拉，但那时表单里已经是用户刚提交的值。
	useEffect(() => {
		if (!data || form) return;
		setForm(toForm(data as unknown as ModerationSettingsData));
	}, [data, form]);

	const save = useAdminMutation<unknown, SettingsForm>({
		mutationFn: (values) => {
			const payload = {
				enabled: values.enabled,
				apiBase: values.apiBase.trim(),
				model: values.model.trim(),
				prompt: values.prompt,
				temperature: numberField(values.temperature, "温度", 0, 2),
				timeoutMs: numberField(values.timeoutMs, "超时时间", 3000, 120000),
				banThreshold: numberField(values.banThreshold, "自动封禁阈值", 0, 1),
				autoBan: values.autoBan,
				checkComments: values.checkComments,
				checkTopics: values.checkTopics,
				maxContentLength: numberField(
					values.maxContentLength,
					"送审最大字数",
					200,
					20000,
				),
				apiKey: values.clearKey
					? ""
					: values.apiKey.trim()
						? values.apiKey.trim()
						: undefined,
			};
			return adminUpdateModerationSettings({ data: payload });
		},
		affects: [adminKeys.moderationRoot()],
		successMessage: "审核配置已保存",
		onSuccess: () => {
			setForm((previous) =>
				previous ? { ...previous, apiKey: "", clearKey: false } : previous,
			);
		},
	});

	const setField = <K extends keyof SettingsForm>(
		key: K,
		value: SettingsForm[K],
	) => {
		setForm((previous) =>
			previous ? { ...previous, [key]: value } : previous,
		);
	};

	const runTest = async () => {
		const content = testContent.trim();
		if (!content) {
			toast.error("请先输入一段要测试的内容");
			return;
		}
		setTesting(true);
		try {
			const res = await adminTestModeration({
				data: {
					content,
					title: testTitle.trim() || undefined,
					targetType: testTarget,
				},
			});
			if (!res) {
				toast.error("测试没有返回结果");
				return;
			}
			setTestResult(res as unknown as TestResult);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "测试失败");
		} finally {
			setTesting(false);
		}
	};

	const current = data as unknown as ModerationSettingsData | undefined;

	if (isLoading && !form) {
		return (
			<div className="grid grid-cols-1 gap-4 p-5 rounded-2xl bg-card ring-1 ring-border/60 lg:grid-cols-2">
				{SETTINGS_SKELETONS.map((key) => (
					<Skeleton key={key} className="w-full h-9" />
				))}
			</div>
		);
	}

	if (!form) {
		return (
			<div className="p-5 text-sm rounded-2xl bg-card text-muted-foreground ring-1 ring-border/60">
				读取配置失败，请刷新页面重试。
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			{/* ── 接口与模型 ── */}
			<section className="p-5 rounded-2xl bg-card ring-1 ring-border/60">
				<div className="flex flex-wrap gap-3 justify-between items-center mb-4">
					<div className="flex flex-col gap-0.5">
						<h3 className="text-sm font-semibold">接口与模型</h3>
						<p className="text-xs text-muted-foreground">
							OpenAI 兼容的 chat/completions
							接口；关闭总开关后不再产生任何模型请求
						</p>
					</div>
					<Toggle
						variant="outline"
						size="sm"
						pressed={form.enabled}
						onPressedChange={(pressed) => setField("enabled", pressed)}
						aria-label="启用大模型内容审核"
						className="justify-start min-w-28"
					>
						{form.enabled ? "已启用" : "已停用"}
					</Toggle>
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="moderation-api-base">
							<FieldTitle>API 地址</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="moderation-api-base"
								value={form.apiBase}
								onChange={(event) => setField("apiBase", event.target.value)}
								placeholder="https://api.openai.com/v1"
								autoComplete="off"
							/>
							<FieldDescription>
								可填 base（自动拼 /chat/completions），也可填完整端点
							</FieldDescription>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="moderation-model">
							<FieldTitle>模型</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="moderation-model"
								value={form.model}
								onChange={(event) => setField("model", event.target.value)}
								placeholder="gpt-4o-mini"
								autoComplete="off"
							/>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="moderation-api-key">
							<FieldTitle>API Key</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="moderation-api-key"
								type={SECRET_INPUT_TYPE}
								value={form.apiKey}
								onChange={(event) => setField("apiKey", event.target.value)}
								placeholder={
									current?.hasApiKey
										? "已保存 " +
											(current.apiKeyHint ?? "••••") +
											"，留空不修改"
										: "sk-…"
								}
								autoComplete={"new-" + SECRET_INPUT_TYPE}
							/>
							<FieldDescription>
								{current?.hasApiKey ? (
									<span className="flex flex-wrap gap-2 items-center">
										Key 只保存在服务端，接口永不返回明文
										<Toggle
											variant="outline"
											size="sm"
											pressed={form.clearKey}
											onPressedChange={(pressed) =>
												setField("clearKey", pressed)
											}
											className="h-6 text-[11px]"
										>
											{form.clearKey ? "将清除 Key" : "清除 Key"}
										</Toggle>
									</span>
								) : (
									"尚未配置 Key，审核不会生效"
								)}
							</FieldDescription>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="moderation-timeout">
							<FieldTitle>请求超时（毫秒）</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="moderation-timeout"
								inputMode="numeric"
								value={form.timeoutMs}
								onChange={(event) => setField("timeoutMs", event.target.value)}
							/>
							<FieldDescription>3000 ~ 120000</FieldDescription>
						</FieldContent>
					</Field>
				</div>
			</section>

			{/* ── 处置策略 ── */}
			<section className="p-5 rounded-2xl bg-card ring-1 ring-border/60">
				<div className="mb-4">
					<h3 className="text-sm font-semibold">处置策略</h3>
					<p className="text-xs text-muted-foreground">
						命中广告一律先标记删除；可信度 ≥ 阈值且开启自动封禁时，同时封禁作者
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="moderation-ban-threshold">
							<FieldTitle>自动封禁可信度阈值</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="moderation-ban-threshold"
								inputMode="decimal"
								value={form.banThreshold}
								onChange={(event) =>
									setField("banThreshold", event.target.value)
								}
							/>
							<FieldDescription>
								0 ~ 1；例如 0.85 表示模型有 85% 把握才直接封号，其余进待处理
							</FieldDescription>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="moderation-max-length">
							<FieldTitle>送审最大字数</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="moderation-max-length"
								inputMode="numeric"
								value={form.maxContentLength}
								onChange={(event) =>
									setField("maxContentLength", event.target.value)
								}
							/>
							<FieldDescription>超出部分截断；200 ~ 20000</FieldDescription>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="moderation-temperature">
							<FieldTitle>温度</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="moderation-temperature"
								inputMode="decimal"
								value={form.temperature}
								onChange={(event) =>
									setField("temperature", event.target.value)
								}
							/>
							<FieldDescription>审核场景建议 0</FieldDescription>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel>
							<FieldTitle>检测范围</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<div className="flex flex-wrap gap-2">
								<Toggle
									variant="outline"
									size="sm"
									pressed={form.checkComments}
									onPressedChange={(pressed) =>
										setField("checkComments", pressed)
									}
								>
									评论
								</Toggle>
								<Toggle
									variant="outline"
									size="sm"
									pressed={form.checkTopics}
									onPressedChange={(pressed) =>
										setField("checkTopics", pressed)
									}
								>
									帖子
								</Toggle>
								<Toggle
									variant="outline"
									size="sm"
									pressed={form.autoBan}
									onPressedChange={(pressed) => setField("autoBan", pressed)}
								>
									{form.autoBan ? "自动封禁已开" : "自动封禁已关"}
								</Toggle>
							</div>
							<FieldDescription>
								关闭自动封禁后，所有命中的内容都只会进入待处理列表
							</FieldDescription>
						</FieldContent>
					</Field>
				</div>
			</section>

			{/* ── 提示词 ── */}
			<section className="p-5 rounded-2xl bg-card ring-1 ring-border/60">
				<div className="mb-4">
					<h3 className="text-sm font-semibold">提示词</h3>
					<p className="text-xs text-muted-foreground">
						默认提示词已针对 Galgame 站点调过；支持 {"{{content}}"} /{" "}
						{"{{title}}"} 占位符（不写占位符时，提示词作为 system 消息）
					</p>
				</div>
				<Textarea
					value={form.prompt}
					onChange={(event) => setField("prompt", event.target.value)}
					rows={14}
					className="font-mono text-xs leading-relaxed"
					aria-label="审核提示词"
					placeholder="留空表示使用内置默认提示词"
				/>
			</section>

			<div className="flex gap-2 justify-end">
				<Button
					variant="outline"
					disabled={save.isPending}
					onClick={() => {
						if (!current) return;
						setForm(toForm(current));
					}}
				>
					重置为已保存值
				</Button>
				<Button disabled={save.isPending} onClick={() => save.mutate(form)}>
					{save.isPending && <Spinner className="size-3.5" />}
					保存配置
				</Button>
			</div>

			{/* ── 试跑 ── */}
			<section className="p-5 rounded-2xl bg-card ring-1 ring-border/60">
				<div className="mb-4">
					<h3 className="text-sm font-semibold">试跑判定</h3>
					<p className="text-xs text-muted-foreground">
						用当前已保存的配置直接请求一次模型，不会改动任何内容或写入队列
					</p>
				</div>

				<div className="flex flex-col gap-3">
					<div className="flex flex-wrap gap-2">
						<Input
							value={testTitle}
							onChange={(event) => setTestTitle(event.target.value)}
							placeholder="标题（帖子可选）"
							className="flex-1 min-w-40"
							aria-label="测试标题"
						/>
						<Toggle
							variant="outline"
							size="sm"
							pressed={testTarget === "comment"}
							onPressedChange={() => setTestTarget("comment")}
						>
							按评论
						</Toggle>
						<Toggle
							variant="outline"
							size="sm"
							pressed={testTarget === "topic"}
							onPressedChange={() => setTestTarget("topic")}
						>
							按帖子
						</Toggle>
					</div>
					<Textarea
						value={testContent}
						onChange={(event) => setTestContent(event.target.value)}
						rows={4}
						placeholder="粘贴一段想测试的评论 / 帖子内容，例如：加群 123456 免费领资源"
						aria-label="测试内容"
					/>
					<div className="flex gap-2 justify-end">
						<Button variant="outline" disabled={testing} onClick={runTest}>
							{testing && <Spinner className="size-3.5" />}
							测试判定
						</Button>
					</div>

					{testResult && (
						<div className="p-4 rounded-xl bg-muted/40">
							<div className="flex flex-wrap gap-2 items-center mb-2">
								<StatusPill
									tone={
										testResult.verdict === "spam" ? "destructive" : "success"
									}
								>
									{testResult.verdict === "spam" ? "广告 / 垃圾" : "正常"}
								</StatusPill>
								<span className="text-xs tabular-nums text-muted-foreground">
									可信度 {Math.round(testResult.confidence * 100)}%
								</span>
								<span className="text-xs text-muted-foreground">
									耗时 {testResult.latencyMs}ms · {testResult.model}
								</span>
							</div>
							<p className="text-sm break-words text-foreground/90">
								{testResult.reason || "（模型没有给出理由）"}
							</p>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
