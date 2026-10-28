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
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import {
	StatusPill,
	type StatusTone,
	Table,
	TableCard,
	TableEmpty,
	TableScroll,
	TableSkeleton,
	TBody,
	Td,
	THead,
	Th,
	Tr,
} from "@web/components/admin/admin-table";
import { ConfirmDialog } from "@web/components/admin/confirm-dialog";
import { DataTableToolbar } from "@web/components/admin/data-table";
import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldLabel,
	FieldTitle,
} from "@web/components/ui/field";
import { Input } from "@web/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
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
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import {
	adminKeys,
	invalidations,
	publicKeys,
} from "@web/lib/admin/query-keys";
import {
	AD_MOBILE_MODE_LABEL,
	AD_SLOT_MAX_ITEMS_LIMIT,
	ADVERT_DEVICE_LABEL,
	ADVERT_STATUS_LABEL,
	type AdMobileMode,
	type AdSlot,
	type AdSlotPayload,
	type AdSlotWithCount,
	type Advert,
	type AdvertDevice,
	type AdvertStatus,
	type PublicAdvert,
} from "@web/lib/adverts";
import { formatCount } from "@web/lib/format-count";
import { cn } from "@web/lib/utils";
import {
	adminCreateAdSlot,
	adminCreateAdvert,
	adminDeleteAdSlot,
	adminDeleteAdvert,
	adminGetAdSlots,
	adminGetAdverts,
	adminReorderAdverts,
	adminUpdateAdSlot,
	adminUpdateAdvert,
} from "@web/server/admin/adverts";
import {
	CalendarClockIcon,
	CalendarXIcon,
	CircleCheckIcon,
	CirclePauseIcon,
	CircleSlashIcon,
	ExternalLinkIcon,
	GripVerticalIcon,
	ImageIcon,
	LayersIcon,
	type LucideIcon,
	MegaphoneIcon,
	MonitorIcon,
	MonitorSmartphoneIcon,
	PencilIcon,
	PlusIcon,
	RotateCwIcon,
	Rows3Icon,
	SmartphoneIcon,
	Trash2Icon,
	TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * 广告位管理页（广告位 + 广告素材两个 Tab）。
 *
 * 行业通用模型（Google Ad Manager / Advanced Ads）：广告位描述「展示在哪里」，
 * 素材描述「展示什么、什么时候展示、给谁展示」。因此页面拆成两层：
 * 1. 广告位：标识 / 同屏条数 / 手机端策略 / 轮播间隔 / 启用；有素材时禁止删除；
 * 2. 广告素材：可按广告位筛选，位内拖动排序；展示由排期推导的状态、设备定向、
 *    权重与曝光/点击/CTR；表单含图片预览、排期（datetime-local）与权重。
 *
 * 结构与 friend-links-page.tsx 同构：TableCard + 工具条 + @dnd-kit 拖动排序
 * + ConfirmDialog 表单/删除弹窗 + useAdminMutation 乐观更新与回滚。
 * 额外的一致性处理：乐观更新同时改后台列表缓存与前台公开缓存
 * （publicKeys.adSlotRoot），停用/删除的素材不会在前台闪现。
 */

// ── 常量 ──────────────────────────────────────────────────────

const AD_MUTATION_KEY = ["admin", "adverts", "mutate"] as const;
const AD_SLOT_MUTATION_KEY = ["admin", "ad-slots", "mutate"] as const;

/** 图片地址：站内根路径（如 /dzmm.webp）或 http(s) 外链 */
const IMAGE_PATTERN = /^(https?:\/\/|\/)\S+$/i;
/** 跳转地址：只允许 http(s)，避免 javascript: 等协议混入 */
const HREF_PATTERN = /^https?:\/\/\S+$/i;
/** 广告位标识：模板里写死的调用键（与 API 的 pattern 一致） */
const SLOT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

/** 「全部广告位」筛选项：Select 的值统一用字符串，避免数字与字符串混用。 */
const ALL_SLOTS = "all";

type SlotFilter = number | typeof ALL_SLOTS;

/**
 * 素材行在 xl 以上用栅格与列头对齐（手柄 / 广告 / 位 / 状态 / 设备 / 权重 / 数据 / 操作），
 * 更窄时退化成 flex-wrap 的两行卡片，避免 8 列在平板上挤成一团。
 */
const ADVERT_ROW_GRID =
	"xl:grid xl:grid-cols-[1.25rem_minmax(0,1.5fr)_7rem_6.5rem_6.5rem_4rem_9rem_4.5rem] xl:items-center xl:gap-3";

/** 投放状态 → 语义色 + 图标（列表与删除确认共用一份映射）。 */
const ADVERT_STATUS_META: Record<
	AdvertStatus,
	{ tone: StatusTone; icon: LucideIcon }
> = {
	running: { tone: "success", icon: CircleCheckIcon },
	scheduled: { tone: "info", icon: CalendarClockIcon },
	expired: { tone: "neutral", icon: CalendarXIcon },
	paused: { tone: "warning", icon: CirclePauseIcon },
};

/** 设备定向 → 语义色 + 图标。 */
const ADVERT_DEVICE_META: Record<
	AdvertDevice,
	{ tone: StatusTone; icon: LucideIcon }
> = {
	all: { tone: "neutral", icon: MonitorSmartphoneIcon },
	desktop: { tone: "info", icon: MonitorIcon },
	mobile: { tone: "info", icon: SmartphoneIcon },
};

/** 手机端展示策略 → 图标。 */
const MOBILE_MODE_ICON: Record<AdMobileMode, LucideIcon> = {
	carousel: RotateCwIcon,
	stack: Rows3Icon,
	hidden: CircleSlashIcon,
};

// ── 表单类型 ──────────────────────────────────────────────────

interface AdSlotFormValues {
	key: string;
	name: string;
	description: string;
	/** 数字字段用字符串存，允许清空后重新输入 */
	maxItems: string;
	mobileMode: AdMobileMode;
	carouselInterval: string;
	enabled: boolean;
}

interface AdvertFormValues {
	/** Select 的值是字符串，提交时才转成数字 */
	slotId: string;
	name: string;
	image: string;
	href: string;
	description: string;
	device: AdvertDevice;
	weight: string;
	/** datetime-local 的本地时间字符串，空串 = 不设排期 */
	startAt: string;
	endAt: string;
	enabled: boolean;
}

type AdSlotFormErrors = {
	key?: string;
	name?: string;
	maxItems?: string;
	carouselInterval?: string;
};

type AdvertFormErrors = {
	slotId?: string;
	name?: string;
	image?: string;
	href?: string;
	weight?: string;
	startAt?: string;
	endAt?: string;
};

const EMPTY_SLOT_FORM: AdSlotFormValues = {
	key: "",
	name: "",
	description: "",
	maxItems: "2",
	mobileMode: "carousel",
	carouselInterval: "5",
	enabled: true,
};

const EMPTY_ADVERT_FORM: AdvertFormValues = {
	slotId: "",
	name: "",
	image: "",
	href: "",
	description: "",
	device: "all",
	weight: "10",
	startAt: "",
	endAt: "",
	enabled: true,
};

// ── 纯函数工具 ────────────────────────────────────────────────

/** 非负整数解析：空串 / 小数 / 负数 / 非数字一律 null（表单校验与提交共用）。 */
function parseInteger(value: string): number | null {
	const trimmed = value.trim();
	if (!/^\d+$/.test(trimmed)) return null;
	const parsed = Number(trimmed);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

/** ISO → <input type="datetime-local"> 需要的本地时间（YYYY-MM-DDTHH:mm）。 */
function toDateTimeLocal(iso: string | null): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (value: number) => String(value).padStart(2, "0");
	const day = [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
	];
	const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return `${day.join("-")}T${time}`;
}

/** datetime-local 的本地时间 → ISO；空串 / 非法值返回 null（= 清空排期）。 */
function fromDateTimeLocal(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

/** 排期区间文案：列表里挂在状态徽标的 title 上，不额外占一列。 */
function scheduleLabel(advert: Advert): string {
	const start = advert.startAt
		? toDateTimeLocal(advert.startAt).replace("T", " ")
		: "立即开始";
	const end = advert.endAt
		? toDateTimeLocal(advert.endAt).replace("T", " ")
		: "长期投放";
	return `${start} → ${end}`;
}

/** CTR：曝光为 0 时显示破折号，避免除零得到 NaN%。 */
function formatCtr(clicks: number, impressions: number): string {
	if (!impressions) return "—";
	const ctr = (clicks / impressions) * 100;
	if (!Number.isFinite(ctr)) return "—";
	return `${ctr.toFixed(1)}%`;
}

function isPublicAdvert(value: PublicAdvert | null): value is PublicAdvert {
	return value !== null;
}

function validateAdSlotForm(values: AdSlotFormValues): AdSlotFormErrors {
	const errors: AdSlotFormErrors = {};
	const key = values.key.trim();
	if (!key) {
		errors.key = "请填写广告位标识";
	} else if (!SLOT_KEY_PATTERN.test(key)) {
		errors.key = "标识需以小写字母开头，仅含小写字母、数字与下划线（2–64 位）";
	}
	if (!values.name.trim()) errors.name = "请填写名称";
	const maxItems = parseInteger(values.maxItems);
	if (maxItems === null || maxItems < 1 || maxItems > AD_SLOT_MAX_ITEMS_LIMIT) {
		errors.maxItems = `同屏条数需为 1–${AD_SLOT_MAX_ITEMS_LIMIT} 的整数`;
	}
	const interval = parseInteger(values.carouselInterval);
	if (interval === null || interval > 60) {
		errors.carouselInterval = "轮播间隔需为 0–60 秒的整数";
	}
	return errors;
}

function validateAdvertForm(values: AdvertFormValues): AdvertFormErrors {
	const errors: AdvertFormErrors = {};
	if (!values.slotId) errors.slotId = "请选择广告位";
	if (!values.name.trim()) errors.name = "请填写名称";

	const image = values.image.trim();
	if (!image) {
		errors.image = "请填写图片地址";
	} else if (!IMAGE_PATTERN.test(image)) {
		errors.image = "图片需是 http(s):// 外链或以 / 开头的站内路径";
	}

	const href = values.href.trim();
	if (!href) {
		errors.href = "请填写跳转链接";
	} else if (!HREF_PATTERN.test(href)) {
		errors.href = "跳转链接需以 http:// 或 https:// 开头";
	}

	const weight = parseInteger(values.weight);
	if (weight === null || weight > 10_000) {
		errors.weight = "权重需为 0–10000 的整数";
	}

	const startAt = fromDateTimeLocal(values.startAt);
	const endAt = fromDateTimeLocal(values.endAt);
	if (values.startAt.trim() && !startAt) errors.startAt = "开始时间格式不正确";
	if (values.endAt.trim() && !endAt) errors.endAt = "结束时间格式不正确";
	if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
		errors.endAt = "结束时间需晚于开始时间";
	}

	return errors;
}

// ── 缓存工具 ──────────────────────────────────────────────────

/** 广告位列表（含素材数）。 */
function updateAdSlotCaches(
	queryClient: QueryClient,
	updater: (slots: AdSlotWithCount[]) => AdSlotWithCount[],
): void {
	const current = queryClient.getQueryData<AdSlotWithCount[]>(
		adminKeys.adSlots(),
	);
	if (!current) return;
	const next = updater(current);
	if (next !== current) queryClient.setQueryData(adminKeys.adSlots(), next);
}

/**
 * 素材列表：按 adminKeys.advertsRoot() 前缀命中「全部」与各广告位筛选的所有列表，
 * 一次改动让每个筛选视图同步（切 Tab / 换筛选不会看到旧数据）。
 */
function updateAdvertCaches(
	queryClient: QueryClient,
	updater: (adverts: Advert[]) => Advert[],
): void {
	for (const [queryKey, list] of queryClient.getQueriesData<Advert[]>({
		queryKey: adminKeys.advertsRoot(),
	})) {
		if (!list) continue;
		const next = updater(list);
		if (next !== list) queryClient.setQueryData(queryKey, next);
	}
}

/** 新增素材后写缓存：只写「全部」与它所属广告位的筛选列表，避免和筛选条件打架。 */
function insertAdvertIntoCache(queryClient: QueryClient, advert: Advert): void {
	for (const [queryKey, list] of queryClient.getQueriesData<Advert[]>({
		queryKey: adminKeys.advertsRoot(),
	})) {
		if (!list) continue;
		const filter = queryKey[3] as number | string | undefined;
		if (filter !== ALL_SLOTS && filter !== advert.slotId) continue;
		queryClient.setQueryData<Advert[]>(queryKey, [...list, advert]);
	}
}

/**
 * 前台公开的广告位缓存（{ slot, desktop[], mobile[] }）。
 * 广告位被停用/删除时缓存里是 null，这里只处理有数据的条目。
 */
function updatePublicAdvertCaches(
	queryClient: QueryClient,
	patch: (advert: PublicAdvert) => PublicAdvert | null,
): void {
	for (const [
		queryKey,
		payload,
	] of queryClient.getQueriesData<AdSlotPayload | null>({
		queryKey: publicKeys.adSlotRoot,
	})) {
		if (!payload) continue;
		queryClient.setQueryData<AdSlotPayload>(queryKey, {
			...payload,
			desktop: payload.desktop.map(patch).filter(isPublicAdvert),
			mobile: payload.mobile.map(patch).filter(isPublicAdvert),
		});
	}
}

/**
 * 广告位自身的公开缓存：名称/条数/策略就地改。
 * 公开缓存按 key 建键，所以停用或改了标识时清的是「旧键」上的那份数据。
 */
function updatePublicSlotCache(
	queryClient: QueryClient,
	slot: AdSlot,
	previousKey?: string,
): void {
	const cachedKey = previousKey ?? slot.key;
	const queryKey = publicKeys.adSlot(cachedKey);
	const payload = queryClient.getQueryData<AdSlotPayload | null>(queryKey);
	if (payload === undefined) return;
	if (!slot.enabled || cachedKey !== slot.key) {
		queryClient.setQueryData(queryKey, null);
		return;
	}
	if (!payload) return;
	queryClient.setQueryData<AdSlotPayload>(queryKey, {
		...payload,
		slot: {
			key: slot.key,
			name: slot.name,
			maxItems: slot.maxItems,
			mobileMode: slot.mobileMode,
			carouselInterval: slot.carouselInterval,
		},
	});
}

/**
 * 位内重排：ids 的下标即新的 sortOrder。
 * 传入的列表可能是「全部广告位」的混合列表，所以只替换该广告位的行，
 * 其它广告位的行保持原位置，切换筛选时不会看到错位。
 */
function reorderSlotAdverts(
	adverts: Advert[],
	slotId: number,
	ids: number[],
): Advert[] {
	const byId = new Map(adverts.map((advert) => [advert.id, advert]));
	const ordered = ids
		.map((id) => byId.get(id))
		.filter((advert): advert is Advert => advert !== undefined)
		.map((advert, index) => ({ ...advert, sortOrder: index }));
	let cursor = 0;
	return adverts.map((advert) => {
		if (advert.slotId !== slotId) return advert;
		const next = ordered[cursor];
		cursor += 1;
		return next ?? advert;
	});
}

// ── 页面 ──────────────────────────────────────────────────────

export default function AdvertsAdminPage() {
	// Tab 写进 URL：刷新 / 分享链接都能回到同一个视图（与 Meilisearch 后台一致）
	// useSearch 的 from 用路由 id，useNavigate 的 from 用完整路径（TanStack 的口径不同）
	const { tab } = useSearch({ from: "/admin/_authL/adverts" });
	// 带上 from，search 的 reducer 才能拿到本路由的 schema 类型
	const navigate = useNavigate({ from: "/admin/adverts" });

	const handleTabChange = (value: string | number | null) => {
		if (value !== "slots" && value !== "adverts") return;
		void navigate({
			search: (previous) => ({ ...previous, tab: value }),
			replace: true,
		});
	};

	return (
		<div className="flex flex-col">
			<AdminPageHeader
				icon={MegaphoneIcon}
				eyebrow="内容管理"
				title="广告位"
				description="广告位决定展示在哪里，素材决定展示什么：支持排期、设备定向、权重轮换与曝光统计"
			/>

			<Tabs value={tab} onValueChange={handleTabChange} className="w-full">
				<div className="overflow-x-auto pb-[5px] -mb-[5px] max-w-full">
					<TabsList variant="line">
						<TabsTrigger value="slots">
							<LayersIcon className="size-4" />
							广告位
						</TabsTrigger>
						<TabsTrigger value="adverts">
							<ImageIcon className="size-4" />
							广告素材
						</TabsTrigger>
					</TabsList>
				</div>

				{/* keepMounted：切回 Tab 时筛选与拖动状态还在，不会重挂载 */}
				<TabsContent value="slots" keepMounted className="mt-4">
					<AdSlotsPanel />
				</TabsContent>
				<TabsContent value="adverts" keepMounted className="mt-4">
					<AdvertsPanel />
				</TabsContent>
			</Tabs>
		</div>
	);
}

// ── 广告位列表 ────────────────────────────────────────────────

function AdSlotsPanel() {
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<AdSlotWithCount | null>(null);
	const [deleting, setDeleting] = useState<AdSlotWithCount | null>(null);

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: adminKeys.adSlots(),
		queryFn: async () => await adminGetAdSlots({ data: {} }),
	});

	const slots = data ?? [];
	const totalAdverts = slots.reduce((sum, slot) => sum + slot.advertCount, 0);

	const openCreate = () => {
		setEditing(null);
		setFormOpen(true);
	};

	const openEdit = (slot: AdSlotWithCount) => {
		setEditing(slot);
		setFormOpen(true);
	};

	return (
		<div className="flex flex-col gap-3">
			<TableCard>
				<DataTableToolbar
					leading={
						<p className="text-xs text-muted-foreground">
							{isLoading
								? "正在加载…"
								: `共 ${slots.length} 个广告位 · ${totalAdverts} 条素材 · 前台按标识读取`}
						</p>
					}
					actions={
						<Button size="sm" onClick={openCreate}>
							<PlusIcon className="size-4" />
							新增广告位
						</Button>
					}
				/>

				<TableScroll>
					<Table minWidth="min-w-[880px]">
						<THead>
							<Tr className="hover:bg-transparent">
								<Th>标识</Th>
								<Th>名称</Th>
								<Th align="center">同屏条数</Th>
								<Th>手机端</Th>
								<Th align="center">素材</Th>
								<Th>状态</Th>
								<Th align="right">操作</Th>
							</Tr>
						</THead>

						{isLoading ? (
							<TableSkeleton columns={7} rows={3} />
						) : (
							<TBody>
								{isError ? (
									<TableEmpty
										colSpan={7}
										icon={TriangleAlertIcon}
										title="广告位加载失败"
										description="接口没有返回数据（网络或服务异常），已保存的配置不受影响，重试即可"
										action={
											<Button
												variant="outline"
												size="sm"
												onClick={() => void refetch()}
											>
												重试
											</Button>
										}
									/>
								) : slots.length === 0 ? (
									<TableEmpty
										colSpan={7}
										icon={MegaphoneIcon}
										title="还没有广告位"
										description="先创建一个广告位（如首页顶部横幅），再往里添加素材"
										action={
											<Button variant="outline" size="sm" onClick={openCreate}>
												<PlusIcon className="size-4" />
												新增广告位
											</Button>
										}
									/>
								) : (
									slots.map((slot) => (
										<AdSlotRow
											key={slot.id}
											slot={slot}
											onEdit={openEdit}
											onDelete={setDeleting}
										/>
									))
								)}
							</TBody>
						)}
					</Table>
				</TableScroll>
			</TableCard>

			<AdSlotFormDialog
				open={formOpen}
				onOpenChange={setFormOpen}
				slot={editing}
			/>

			<DeleteAdSlotDialog
				slot={deleting}
				open={deleting !== null}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
			/>
		</div>
	);
}

function AdSlotRow({
	slot,
	onEdit,
	onDelete,
}: {
	slot: AdSlotWithCount;
	onEdit: (slot: AdSlotWithCount) => void;
	onDelete: (slot: AdSlotWithCount) => void;
}) {
	const MobileIcon = MOBILE_MODE_ICON[slot.mobileMode];

	return (
		<Tr className={cn(!slot.enabled && "opacity-70")}>
			<Td>
				<code className="px-1.5 py-0.5 text-xs rounded bg-muted text-foreground/80">
					{slot.key}
				</code>
			</Td>

			<Td>
				<div className="flex flex-col gap-0.5 max-w-[22rem] min-w-0">
					<span className="text-sm font-medium truncate">{slot.name}</span>
					<span className="text-xs line-clamp-1 text-muted-foreground">
						{slot.description?.trim() || "—"}
					</span>
				</div>
			</Td>

			<Td align="center">
				<span className="text-xs tabular-nums">{slot.maxItems} 条</span>
			</Td>

			<Td>
				<div className="flex gap-1.5 items-center">
					<StatusPill tone="neutral" icon={MobileIcon}>
						{AD_MOBILE_MODE_LABEL[slot.mobileMode]}
					</StatusPill>
					{slot.mobileMode === "carousel" && slot.carouselInterval > 0 ? (
						<span className="text-xs tabular-nums text-muted-foreground">
							{slot.carouselInterval}s
						</span>
					) : null}
				</div>
			</Td>

			<Td align="center">
				<span
					className={cn(
						"text-xs tabular-nums",
						slot.advertCount > 0 ? "text-foreground" : "text-muted-foreground",
					)}
					title={
						slot.advertCount > 0
							? "该广告位下还有素材，需先删除素材才能删除广告位"
							: "该广告位下暂无素材"
					}
				>
					{slot.advertCount}
				</span>
			</Td>

			<Td>
				{slot.enabled ? (
					<StatusPill tone="success" icon={CircleCheckIcon}>
						启用
					</StatusPill>
				) : (
					<StatusPill tone="neutral" icon={CircleSlashIcon}>
						已停用
					</StatusPill>
				)}
			</Td>

			<Td align="right">
				<div className="flex gap-1 items-center justify-end">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => onEdit(slot)}
						aria-label={`编辑 ${slot.name}`}
						title="编辑"
						className="text-muted-foreground hover:text-foreground"
					>
						<PencilIcon className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={() => onDelete(slot)}
						aria-label={`删除 ${slot.name}`}
						title="删除"
						className="text-muted-foreground hover:text-destructive"
					>
						<Trash2Icon className="size-4" />
					</Button>
				</div>
			</Td>
		</Tr>
	);
}

// ── 广告位新增 / 编辑 ─────────────────────────────────────────

function AdSlotFormDialog({
	open,
	onOpenChange,
	slot,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	slot: AdSlotWithCount | null;
}) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<AdSlotFormValues>(EMPTY_SLOT_FORM);
	const [errors, setErrors] = useState<AdSlotFormErrors>({});

	const isEdit = slot !== null;

	// 每次打开都按当前编辑对象重置表单，避免残留上一次的输入
	useEffect(() => {
		if (!open) return;
		setForm({
			key: slot?.key ?? "",
			name: slot?.name ?? "",
			description: slot?.description ?? "",
			maxItems: String(slot?.maxItems ?? 2),
			mobileMode: slot?.mobileMode ?? "carousel",
			carouselInterval: String(slot?.carouselInterval ?? 5),
			enabled: slot?.enabled ?? true,
		});
		setErrors({});
	}, [open, slot]);

	const mutation = useAdminMutation<
		AdSlot | null,
		{ slot: AdSlotWithCount | null; values: AdSlotFormValues }
	>({
		mutationKey: AD_SLOT_MUTATION_KEY,
		mutationFn: async ({ slot: target, values }) => {
			const payload = {
				key: values.key.trim(),
				name: values.name.trim(),
				description: values.description.trim(),
				maxItems: parseInteger(values.maxItems) ?? 1,
				mobileMode: values.mobileMode,
				carouselInterval: parseInteger(values.carouselInterval) ?? 0,
				enabled: values.enabled,
			};
			if (target) {
				const updated = await adminUpdateAdSlot({
					data: { id: target.id, ...payload },
				});
				if (!updated) throw new Error("更新广告位失败");
				return updated;
			}
			const created = await adminCreateAdSlot({ data: payload });
			if (!created) throw new Error("新增广告位失败");
			return created;
		},
		optimistic: (queryClient, { slot: target, values }) => {
			// 新建还没有 id，等提交成功后再插入缓存；编辑直接就地改
			if (!target) return;
			const next: AdSlot = {
				...target,
				key: values.key.trim(),
				name: values.name.trim(),
				description: values.description.trim() || null,
				maxItems: parseInteger(values.maxItems) ?? target.maxItems,
				mobileMode: values.mobileMode,
				carouselInterval:
					parseInteger(values.carouselInterval) ?? target.carouselInterval,
				enabled: values.enabled,
			};
			updateAdSlotCaches(queryClient, (slots) =>
				slots.map((item) =>
					item.id === target.id ? { ...item, ...next } : item,
				),
			);
			updatePublicSlotCache(queryClient, next, target.key);
		},
		affects: invalidations.adverts,
		successMessage: (_data, vars) =>
			vars.slot ? "广告位已更新" : "广告位已新增",
		onSuccess: (data, vars) => {
			if (!vars.slot && data) {
				// 提交成功后插入缓存，列表立即出现新行（随后由失效校正真值）
				updateAdSlotCaches(queryClient, (slots) => [
					...slots,
					{ ...data, advertCount: 0 },
				]);
			}
			onOpenChange(false);
		},
	});

	const valid = useMemo(
		() => Object.keys(validateAdSlotForm(form)).length === 0,
		[form],
	);

	const handleSubmit = () => {
		if (mutation.isPending) return;
		const nextErrors = validateAdSlotForm(form);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		mutation.mutate({ slot, values: form });
	};

	const setField = <K extends keyof AdSlotFormValues>(
		key: K,
		value: AdSlotFormValues[K],
	) => {
		setForm((previous) => ({ ...previous, [key]: value }));
	};

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title={isEdit ? "编辑广告位" : "新增广告位"}
			desc="标识用于前台模板读取（如 home_top），创建后不建议再改"
			confirmText={isEdit ? "保存" : "创建"}
			isLoading={mutation.isPending}
			disabled={!valid}
			onConfirm={handleSubmit}
			className="max-w-lg"
		>
			<div
				className="flex overflow-y-auto flex-col gap-4 max-h-[60vh] pr-1"
				onKeyDown={(event) => {
					// 只在文本输入框里回车提交；开关上的回车留给可访问性
					if (
						event.key === "Enter" &&
						event.target instanceof HTMLInputElement
					) {
						event.preventDefault();
						handleSubmit();
					}
				}}
			>
				<Field>
					<FieldLabel htmlFor="ad-slot-key">
						<FieldTitle>标识</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Input
							id="ad-slot-key"
							value={form.key}
							onChange={(event) => setField("key", event.target.value)}
							placeholder="home_top"
							maxLength={64}
							autoComplete="off"
							spellCheck={false}
							aria-invalid={errors.key ? true : undefined}
							aria-describedby={errors.key ? "ad-slot-key-error" : undefined}
						/>
						<FieldDescription>
							小写字母开头，仅含小写字母、数字与下划线（2–64 位）
						</FieldDescription>
						<FieldError id="ad-slot-key-error">{errors.key}</FieldError>
					</FieldContent>
				</Field>

				<Field>
					<FieldLabel htmlFor="ad-slot-name">
						<FieldTitle>名称</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Input
							id="ad-slot-name"
							value={form.name}
							onChange={(event) => setField("name", event.target.value)}
							placeholder="如：首页顶部横幅"
							maxLength={255}
							aria-invalid={errors.name ? true : undefined}
							aria-describedby={errors.name ? "ad-slot-name-error" : undefined}
						/>
						<FieldError id="ad-slot-name-error">{errors.name}</FieldError>
					</FieldContent>
				</Field>

				<Field>
					<FieldLabel htmlFor="ad-slot-description">
						<FieldTitle>描述</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Textarea
							id="ad-slot-description"
							value={form.description}
							onChange={(event) => setField("description", event.target.value)}
							placeholder="这个广告位在页面上的位置与用途（可选）"
							maxLength={2048}
							rows={2}
						/>
					</FieldContent>
				</Field>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="ad-slot-max-items">
							<FieldTitle>同屏条数</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="ad-slot-max-items"
								type="number"
								min={1}
								max={AD_SLOT_MAX_ITEMS_LIMIT}
								step={1}
								inputMode="numeric"
								value={form.maxItems}
								onChange={(event) => setField("maxItems", event.target.value)}
								aria-invalid={errors.maxItems ? true : undefined}
								aria-describedby={
									errors.maxItems ? "ad-slot-max-items-error" : undefined
								}
							/>
							<FieldDescription>
								同一轮最多展示 1–{AD_SLOT_MAX_ITEMS_LIMIT} 条
							</FieldDescription>
							<FieldError id="ad-slot-max-items-error">
								{errors.maxItems}
							</FieldError>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="ad-slot-interval">
							<FieldTitle>轮播间隔（秒）</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="ad-slot-interval"
								type="number"
								min={0}
								max={60}
								step={1}
								inputMode="numeric"
								value={form.carouselInterval}
								onChange={(event) =>
									setField("carouselInterval", event.target.value)
								}
								aria-invalid={errors.carouselInterval ? true : undefined}
								aria-describedby={
									errors.carouselInterval ? "ad-slot-interval-error" : undefined
								}
							/>
							<FieldDescription>0 表示不自动切换</FieldDescription>
							<FieldError id="ad-slot-interval-error">
								{errors.carouselInterval}
							</FieldError>
						</FieldContent>
					</Field>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="ad-slot-mobile-mode">
							<FieldTitle>手机端策略</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Select
								value={form.mobileMode}
								onValueChange={(next) => {
									if (
										next === "carousel" ||
										next === "stack" ||
										next === "hidden"
									) {
										setField("mobileMode", next);
									}
								}}
							>
								<SelectTrigger id="ad-slot-mobile-mode" className="w-full">
									<SelectValue placeholder="选择手机端策略" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="carousel">
										{AD_MOBILE_MODE_LABEL.carousel}
									</SelectItem>
									<SelectItem value="stack">
										{AD_MOBILE_MODE_LABEL.stack}
									</SelectItem>
									<SelectItem value="hidden">
										{AD_MOBILE_MODE_LABEL.hidden}
									</SelectItem>
								</SelectContent>
							</Select>
							<FieldDescription>
								只影响手机端，桌面始终并排展示
							</FieldDescription>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="ad-slot-enabled">
							<FieldTitle>启用</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Toggle
								id="ad-slot-enabled"
								variant="outline"
								size="sm"
								pressed={form.enabled}
								onPressedChange={(pressed) => setField("enabled", pressed)}
								aria-label="前台启用该广告位"
								className="justify-start w-full"
							>
								{form.enabled ? "已启用" : "已停用"}
							</Toggle>
							<FieldDescription>关闭后前台立即不再展示该位</FieldDescription>
						</FieldContent>
					</Field>
				</div>
			</div>
		</ConfirmDialog>
	);
}

// ── 广告位删除 ────────────────────────────────────────────────

function DeleteAdSlotDialog({
	slot,
	open,
	onOpenChange,
}: {
	slot: AdSlotWithCount | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const mutation = useAdminMutation<
		{ success: boolean },
		{ slot: AdSlotWithCount }
	>({
		mutationKey: AD_SLOT_MUTATION_KEY,
		mutationFn: async ({ slot: target }) => {
			const res = await adminDeleteAdSlot({ data: { id: target.id } });
			if (!res?.success) throw new Error("删除广告位失败");
			return res;
		},
		optimistic: (queryClient, { slot: target }) => {
			// 广告位删除后该位下的素材由 DB 级联删除，缓存同步清掉
			updateAdSlotCaches(queryClient, (slots) =>
				slots.filter((item) => item.id !== target.id),
			);
			updateAdvertCaches(queryClient, (adverts) =>
				adverts.filter((advert) => advert.slotId !== target.id),
			);
			queryClient.setQueryData(publicKeys.adSlot(target.key), null);
		},
		affects: invalidations.adverts,
		successMessage: "广告位已删除",
		onSuccess: () => onOpenChange(false),
	});

	if (!slot) return null;

	// 有素材时先拦截：API 也会返回 400，但前端先把原因说清楚
	const blocked = slot.advertCount > 0;

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title="删除广告位"
			desc={
				blocked
					? `「${slot.name}」下还有 ${slot.advertCount} 条素材，请先到「广告素材」里删除这些素材，再删除广告位。`
					: `确定要删除「${slot.name}」吗？删除后前台该位置立即不再展示广告，且无法恢复。`
			}
			destructive
			confirmText="确认删除"
			isLoading={mutation.isPending}
			disabled={blocked}
			onConfirm={() => mutation.mutate({ slot })}
		/>
	);
}

// ── 广告素材列表 ──────────────────────────────────────────────

function AdvertsPanel() {
	const [slotFilter, setSlotFilter] = useState<SlotFilter>(ALL_SLOTS);
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<Advert | null>(null);
	const [deleting, setDeleting] = useState<Advert | null>(null);
	// 拖动期间用本地顺序覆盖服务端顺序；乐观缓存追上后由 mutation 回调清空
	const [orderOverride, setOrderOverride] = useState<number[] | null>(null);

	const { data: slotsData } = useQuery({
		queryKey: adminKeys.adSlots(),
		queryFn: async () => await adminGetAdSlots({ data: {} }),
	});
	const slots = slotsData ?? [];
	const slotNameById = new Map(slots.map((slot) => [slot.id, slot.name]));

	const slotId = slotFilter === ALL_SLOTS ? null : slotFilter;

	const { data, isLoading, isFetching, isError, refetch } = useQuery({
		queryKey: adminKeys.adverts(slotId),
		queryFn: async () =>
			await adminGetAdverts({ data: slotId == null ? {} : { slotId } }),
	});

	const byId = new Map((data ?? []).map((advert) => [advert.id, advert]));
	const list = orderOverride
		? orderOverride
				.map((id) => byId.get(id))
				.filter((advert): advert is Advert => advert !== undefined)
		: (data ?? []);

	// 位内才能排序：跨广告位的「全部」视图里 sortOrder 没有可比性
	const canDrag = slotId !== null && list.length > 1;

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const reorder = useAdminMutation<
		{ success: boolean },
		{ slotId: number; ids: number[] }
	>({
		mutationKey: AD_MUTATION_KEY,
		mutationFn: async ({ slotId: targetSlotId, ids }) => {
			const res = await adminReorderAdverts({
				data: { slotId: targetSlotId, ids },
			});
			if (!res?.success) throw new Error("保存排序失败");
			return res;
		},
		optimistic: (queryClient, { slotId: targetSlotId, ids }) => {
			updateAdvertCaches(queryClient, (adverts) =>
				reorderSlotAdverts(adverts, targetSlotId, ids),
			);
		},
		affects: invalidations.adverts,
		// 拖一次就弹一次 toast 太吵，失败时才提示
		successMessage: "",
		errorMessage: "保存排序失败，已恢复原顺序",
		onSuccess: () => setOrderOverride(null),
		onError: () => setOrderOverride(null),
	});

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id || slotId === null) return;

		const oldIndex = list.findIndex((item) => item.id === active.id);
		const newIndex = list.findIndex((item) => item.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const next = arrayMove(list, oldIndex, newIndex);
		// 先本地定序，避免松手到缓存更新之间闪回旧顺序
		setOrderOverride(next.map((item) => item.id));
		reorder.mutate({ slotId, ids: next.map((item) => item.id) });
	};

	const handleSlotFilterChange = (value: string | null) => {
		if (value === null) return;
		setOrderOverride(null);
		setSlotFilter(value === ALL_SLOTS ? ALL_SLOTS : Number(value));
	};

	const openCreate = () => {
		setEditing(null);
		setFormOpen(true);
	};

	const saving = reorder.isPending;
	const noSlots = slots.length === 0;

	return (
		<TableCard>
			<DataTableToolbar
				leading={
					<div className="flex flex-wrap gap-2 items-center">
						<Select
							value={slotFilter === ALL_SLOTS ? ALL_SLOTS : String(slotFilter)}
							onValueChange={handleSlotFilterChange}
						>
							<SelectTrigger size="sm" className="w-44">
								<SelectValue placeholder="选择广告位" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ALL_SLOTS}>全部广告位</SelectItem>
								{slots.map((slot) => (
									<SelectItem key={slot.id} value={String(slot.id)}>
										{slot.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							{isLoading
								? "正在加载…"
								: `共 ${list.length} 条 · ${
										slotId === null
											? "选择单个广告位后可拖动排序"
											: "拖动左侧手柄调整位内顺序"
									}`}
						</p>
					</div>
				}
				actions={
					<div className="flex gap-2 items-center">
						{saving ? (
							<span className="inline-flex gap-1.5 items-center text-xs text-muted-foreground">
								<Spinner className="size-3" />
								正在保存排序…
							</span>
						) : null}
						<Button
							size="sm"
							onClick={openCreate}
							disabled={noSlots}
							title={noSlots ? "请先到「广告位」Tab 创建一个广告位" : undefined}
						>
							<PlusIcon className="size-4" />
							新增广告
						</Button>
					</div>
				}
			/>

			{/* 桌面端列头（窄屏行内自解释，不重复表头） */}
			<div
				className={cn(
					"hidden px-4 py-2.5 text-xs font-medium text-muted-foreground border-b border-border/60 bg-[color:var(--table-header)]",
					ADVERT_ROW_GRID,
				)}
			>
				<span className="sr-only">拖拽排序</span>
				<span>广告</span>
				<span>广告位</span>
				<span>状态</span>
				<span>设备</span>
				<span className="xl:text-center">权重</span>
				<span className="xl:text-right">曝光 / 点击 / CTR</span>
				<span className="text-right">操作</span>
			</div>

			{isLoading ? (
				<div className="flex flex-col">
					{Array.from({ length: 4 }).map((_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 骨架行无稳定 id
						<AdvertRowSkeleton key={index} />
					))}
				</div>
			) : isError ? (
				<EmptyState
					icon={TriangleAlertIcon}
					title="广告列表加载失败"
					description="接口没有返回数据（网络或服务异常），已保存的广告不受影响，重试即可"
					size="sm"
					action={
						<Button variant="outline" size="sm" onClick={() => void refetch()}>
							重试
						</Button>
					}
				/>
			) : list.length === 0 ? (
				<EmptyState
					icon={ImageIcon}
					title={noSlots ? "还没有广告位" : "暂无广告素材"}
					description={
						noSlots
							? "先到「广告位」Tab 创建一个广告位（如首页顶部横幅），再来添加素材"
							: slotId === null
								? "添加第一条素材，前台会按排期与权重自动投放"
								: "该广告位下还没有素材，添加一条即可开始投放"
					}
					size="sm"
					action={
						<Button
							variant="outline"
							size="sm"
							onClick={openCreate}
							disabled={noSlots}
						>
							<PlusIcon className="size-4" />
							新增广告
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
							{list.map((advert) => (
								<SortableAdvertRow
									key={advert.id}
									advert={advert}
									slotName={slotNameById.get(advert.slotId) ?? "—"}
									draggable={canDrag}
									disabled={saving}
									onEdit={(target) => {
										setEditing(target);
										setFormOpen(true);
									}}
									onDelete={setDeleting}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}

			<AdvertFormDialog
				open={formOpen}
				onOpenChange={setFormOpen}
				advert={editing}
				slots={slots}
				defaultSlotId={slotId}
			/>

			<DeleteAdvertDialog
				advert={deleting}
				open={deleting !== null}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
			/>
		</TableCard>
	);
}

// ── 素材骨架 ──────────────────────────────────────────────────

function AdvertRowSkeleton() {
	return (
		<div
			aria-busy="true"
			className="flex gap-3 items-center px-4 py-3 border-b border-border/60 last:border-0"
		>
			<Skeleton className="size-4 rounded" />
			<Skeleton className="rounded-lg h-10 w-32" />
			<div className="flex flex-col flex-1 gap-1.5">
				<Skeleton className="w-32 h-4" />
				<Skeleton className="w-48 h-3" />
			</div>
			<Skeleton className="w-20 h-5 rounded-full" />
			<Skeleton className="w-16 h-5 rounded-full" />
			<Skeleton className="size-8 rounded-lg" />
		</div>
	);
}

// ── 可拖拽素材行 ──────────────────────────────────────────────

function SortableAdvertRow({
	advert,
	slotName,
	draggable,
	disabled,
	onEdit,
	onDelete,
}: {
	advert: Advert;
	slotName: string;
	draggable: boolean;
	disabled: boolean;
	onEdit: (advert: Advert) => void;
	onDelete: (advert: Advert) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: advert.id, disabled: disabled || !draggable });

	const status = ADVERT_STATUS_META[advert.status];
	const device = ADVERT_DEVICE_META[advert.device];
	const StatusIcon = status.icon;
	const DeviceIcon = device.icon;
	const dragDisabled = disabled || !draggable;

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
				ADVERT_ROW_GRID,
				isDragging && "relative z-30 shadow-md bg-muted/60",
			)}
		>
			<button
				ref={setActivatorNodeRef}
				type="button"
				{...attributes}
				{...listeners}
				aria-label={`拖拽排序 ${advert.name}`}
				disabled={dragDisabled}
				title={draggable ? "拖动调整位内顺序" : "选择单个广告位后可拖动排序"}
				className="shrink-0 rounded text-muted-foreground cursor-grab touch-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed"
			>
				<GripVerticalIcon className="size-4" />
			</button>

			<div className="flex flex-1 gap-3 items-center min-w-0">
				<AdvertThumb advert={advert} />
				<div className="flex flex-col gap-0.5 min-w-0">
					<span className="text-sm font-medium truncate">{advert.name}</span>
					<a
						href={advert.href}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex gap-1 items-center max-w-full w-fit text-xs rounded transition-colors duration-200 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					>
						<span className="truncate">{advert.href}</span>
						<ExternalLinkIcon className="shrink-0 size-3" />
					</a>
				</div>
			</div>

			<span
				className="px-2 h-5 text-xs leading-5 truncate rounded-full bg-muted text-muted-foreground"
				title={slotName}
			>
				{slotName}
			</span>

			<span
				title={`${ADVERT_STATUS_LABEL[advert.status]} · ${scheduleLabel(
					advert,
				)}`}
			>
				<StatusPill tone={status.tone} icon={StatusIcon}>
					{ADVERT_STATUS_LABEL[advert.status]}
				</StatusPill>
			</span>

			<StatusPill tone={device.tone} icon={DeviceIcon}>
				{ADVERT_DEVICE_LABEL[advert.device]}
			</StatusPill>

			<span
				className="text-xs tabular-nums text-muted-foreground xl:text-center"
				title="权重：候选多于展示位时按权重随机轮换"
			>
				{advert.weight}
			</span>

			<div
				className="flex gap-2 justify-start items-center text-xs tabular-nums text-muted-foreground xl:justify-end"
				title={`曝光 ${advert.impressions} · 点击 ${advert.clicks}`}
			>
				<span>曝 {formatCount(advert.impressions)}</span>
				<span className="text-border">/</span>
				<span>点 {formatCount(advert.clicks)}</span>
				<span className="text-border">/</span>
				<span>CTR {formatCtr(advert.clicks, advert.impressions)}</span>
			</div>

			<div className="flex shrink-0 gap-1 items-center justify-end">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => onEdit(advert)}
					aria-label={`编辑 ${advert.name}`}
					title="编辑"
					className="text-muted-foreground hover:text-foreground"
				>
					<PencilIcon className="size-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => onDelete(advert)}
					aria-label={`删除 ${advert.name}`}
					title="删除"
					className="text-muted-foreground hover:text-destructive"
				>
					<Trash2Icon className="size-4" />
				</Button>
			</div>
		</div>
	);
}

/** 横幅缩略图：前台展示的就是这张图，空地址用占位块兜底。 */
function AdvertThumb({ advert }: { advert: Advert }) {
	if (!advert.image) {
		return (
			<div className="flex shrink-0 justify-center items-center rounded-lg h-10 w-32 bg-muted text-[10px] text-muted-foreground">
				无图片
			</div>
		);
	}
	return (
		<img
			src={advert.image}
			alt={advert.name}
			loading="lazy"
			className="object-cover shrink-0 bg-muted rounded-lg border h-10 w-32 border-border/60"
		/>
	);
}

// ── 素材新增 / 编辑 ───────────────────────────────────────────

function AdvertFormDialog({
	open,
	onOpenChange,
	advert,
	slots,
	defaultSlotId,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	advert: Advert | null;
	slots: AdSlotWithCount[];
	defaultSlotId: number | null;
}) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState<AdvertFormValues>(EMPTY_ADVERT_FORM);
	const [errors, setErrors] = useState<AdvertFormErrors>({});

	const isEdit = advert !== null;
	// 作为依赖用的稳定标量：slots 数组引用会随重新取数变化，不能直接进依赖
	const firstSlotId = slots[0]?.id ?? null;

	// 每次打开都按当前编辑对象重置表单，避免残留上一次的输入
	useEffect(() => {
		if (!open) return;
		setForm({
			slotId: String(advert?.slotId ?? defaultSlotId ?? firstSlotId ?? ""),
			name: advert?.name ?? "",
			image: advert?.image ?? "",
			href: advert?.href ?? "",
			description: advert?.description ?? "",
			device: advert?.device ?? "all",
			weight: String(advert?.weight ?? 10),
			startAt: toDateTimeLocal(advert?.startAt ?? null),
			endAt: toDateTimeLocal(advert?.endAt ?? null),
			enabled: advert?.enabled ?? true,
		});
		setErrors({});
	}, [open, advert, defaultSlotId, firstSlotId]);

	const mutation = useAdminMutation<
		Advert | null,
		{ advert: Advert | null; values: AdvertFormValues }
	>({
		mutationKey: AD_MUTATION_KEY,
		mutationFn: async ({ advert: target, values }) => {
			const targetSlotId = Number(values.slotId);
			const startAt = fromDateTimeLocal(values.startAt);
			const endAt = fromDateTimeLocal(values.endAt);
			const common = {
				name: values.name.trim(),
				image: values.image.trim(),
				href: values.href.trim(),
				description: values.description.trim(),
				device: values.device,
				weight: parseInteger(values.weight) ?? 10,
				enabled: values.enabled,
			};
			if (target) {
				// 更新时显式传 null 表示清空排期（契约：只传一侧时由 API 比较先后）
				const updated = await adminUpdateAdvert({
					data: { id: target.id, ...common, startAt, endAt },
				});
				if (!updated) throw new Error("更新广告失败");
				return updated;
			}
			const created = await adminCreateAdvert({
				data: {
					slotId: targetSlotId,
					...common,
					...(startAt ? { startAt } : {}),
					...(endAt ? { endAt } : {}),
				},
			});
			if (!created) throw new Error("新增广告失败");
			return created;
		},
		optimistic: (queryClient, { advert: target, values }) => {
			// 新建还没有 id，等提交成功后再插入缓存；编辑直接就地改
			if (!target) return;
			const nextStartAt = fromDateTimeLocal(values.startAt);
			const nextEndAt = fromDateTimeLocal(values.endAt);
			updateAdvertCaches(queryClient, (adverts) =>
				adverts.map((item) =>
					item.id === target.id
						? {
								...item,
								name: values.name.trim(),
								image: values.image.trim(),
								href: values.href.trim(),
								description: values.description.trim() || null,
								device: values.device,
								weight: parseInteger(values.weight) ?? item.weight,
								startAt: nextStartAt,
								endAt: nextEndAt,
								enabled: values.enabled,
							}
						: item,
				),
			);
			// 公开缓存：停用后前台立即消失，否则就地改文案/图片/定向
			updatePublicAdvertCaches(queryClient, (publicAdvert) => {
				if (publicAdvert.id !== target.id) return publicAdvert;
				if (!values.enabled) return null;
				return {
					id: target.id,
					name: values.name.trim(),
					image: values.image.trim(),
					href: values.href.trim(),
					device: values.device,
				};
			});
		},
		affects: invalidations.adverts,
		successMessage: (_data, vars) =>
			vars.advert ? "广告已更新" : "广告已新增",
		onSuccess: (data, vars) => {
			if (!vars.advert && data) {
				// 提交成功后写缓存，列表立即出现新行（随后由失效校正真值）
				insertAdvertIntoCache(queryClient, data);
				updateAdSlotCaches(queryClient, (slots) =>
					slots.map((slot) =>
						slot.id === data.slotId
							? { ...slot, advertCount: slot.advertCount + 1 }
							: slot,
					),
				);
			}
			onOpenChange(false);
		},
	});

	const valid = useMemo(
		() => Object.keys(validateAdvertForm(form)).length === 0,
		[form],
	);

	const handleSubmit = () => {
		if (mutation.isPending) return;
		const nextErrors = validateAdvertForm(form);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		mutation.mutate({ advert, values: form });
	};

	const setField = <K extends keyof AdvertFormValues>(
		key: K,
		value: AdvertFormValues[K],
	) => {
		setForm((previous) => ({ ...previous, [key]: value }));
	};

	const imagePreview = IMAGE_PATTERN.test(form.image.trim())
		? form.image.trim()
		: null;

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title={isEdit ? "编辑广告" : "新增广告"}
			desc="广告位、名称、图片地址与跳转链接为必填项；备注只在后台可见"
			confirmText={isEdit ? "保存" : "创建"}
			isLoading={mutation.isPending}
			disabled={!valid}
			onConfirm={handleSubmit}
			className="max-w-xl"
		>
			<div
				className="flex overflow-y-auto flex-col gap-4 max-h-[62vh] pr-1"
				onKeyDown={(event) => {
					// 只在文本输入框里回车提交；下拉与开关上的回车留给可访问性
					if (
						event.key === "Enter" &&
						event.target instanceof HTMLInputElement
					) {
						event.preventDefault();
						handleSubmit();
					}
				}}
			>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="advert-slot">
							<FieldTitle>广告位</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Select
								value={form.slotId}
								onValueChange={(next) => {
									if (next !== null) setField("slotId", next);
								}}
								disabled={isEdit}
							>
								<SelectTrigger id="advert-slot" className="w-full">
									<SelectValue placeholder="选择广告位" />
								</SelectTrigger>
								<SelectContent>
									{slots.map((slot) => (
										<SelectItem key={slot.id} value={String(slot.id)}>
											{slot.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldDescription>
								{isEdit
									? "创建后不能更换广告位，需要移动请重新创建"
									: "决定这条素材展示在哪个位置"}
							</FieldDescription>
							<FieldError id="advert-slot-error">{errors.slotId}</FieldError>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="advert-name">
							<FieldTitle>名称</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="advert-name"
								value={form.name}
								onChange={(event) => setField("name", event.target.value)}
								placeholder="如：DZMM AI 女友"
								maxLength={255}
								aria-invalid={errors.name ? true : undefined}
								aria-describedby={errors.name ? "advert-name-error" : undefined}
							/>
							<FieldDescription>后台识别名，同时作为图片 alt</FieldDescription>
							<FieldError id="advert-name-error">{errors.name}</FieldError>
						</FieldContent>
					</Field>
				</div>

				<Field>
					<FieldLabel htmlFor="advert-image">
						<FieldTitle>图片地址</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Input
							id="advert-image"
							value={form.image}
							onChange={(event) => setField("image", event.target.value)}
							placeholder="/dzmm.webp 或 https://example.com/banner.webp"
							maxLength={2048}
							aria-invalid={errors.image ? true : undefined}
							aria-describedby={errors.image ? "advert-image-error" : undefined}
						/>
						<div className="flex gap-3 items-center mt-1.5">
							{imagePreview ? (
								<img
									src={imagePreview}
									alt="广告图片预览"
									className="object-cover shrink-0 bg-muted rounded-lg border h-10 w-32 border-border/60"
								/>
							) : (
								<div className="flex shrink-0 justify-center items-center rounded-lg border border-dashed h-10 w-32 border-border/60 bg-muted/40 text-[10px] text-muted-foreground">
									图片预览
								</div>
							)}
							<FieldDescription>
								支持站内路径（如 /dzmm.webp）与 https 外链
							</FieldDescription>
						</div>
						<FieldError id="advert-image-error">{errors.image}</FieldError>
					</FieldContent>
				</Field>

				<Field>
					<FieldLabel htmlFor="advert-href">
						<FieldTitle>跳转链接</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Input
							id="advert-href"
							value={form.href}
							onChange={(event) => setField("href", event.target.value)}
							placeholder="https://example.com/activity"
							maxLength={2048}
							aria-invalid={errors.href ? true : undefined}
							aria-describedby={errors.href ? "advert-href-error" : undefined}
						/>
						<FieldDescription>点击横幅后打开该地址</FieldDescription>
						<FieldError id="advert-href-error">{errors.href}</FieldError>
					</FieldContent>
				</Field>

				<Field>
					<FieldLabel htmlFor="advert-description">
						<FieldTitle>备注</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Textarea
							id="advert-description"
							value={form.description}
							onChange={(event) => setField("description", event.target.value)}
							placeholder="投放说明，如合作方、结算方式（可选，前台不展示）"
							maxLength={2048}
							rows={2}
						/>
					</FieldContent>
				</Field>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="advert-device">
							<FieldTitle>设备定向</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Select
								value={form.device}
								onValueChange={(next) => {
									if (
										next === "all" ||
										next === "desktop" ||
										next === "mobile"
									) {
										setField("device", next);
									}
								}}
							>
								<SelectTrigger id="advert-device" className="w-full">
									<SelectValue placeholder="选择设备" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">{ADVERT_DEVICE_LABEL.all}</SelectItem>
									<SelectItem value="desktop">
										{ADVERT_DEVICE_LABEL.desktop}
									</SelectItem>
									<SelectItem value="mobile">
										{ADVERT_DEVICE_LABEL.mobile}
									</SelectItem>
								</SelectContent>
							</Select>
							<FieldDescription>定向在服务端筛选</FieldDescription>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="advert-weight">
							<FieldTitle>权重</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="advert-weight"
								type="number"
								min={0}
								max={10000}
								step={1}
								inputMode="numeric"
								value={form.weight}
								onChange={(event) => setField("weight", event.target.value)}
								aria-invalid={errors.weight ? true : undefined}
								aria-describedby={
									errors.weight ? "advert-weight-error" : undefined
								}
							/>
							<FieldDescription>候选多于展示位时按权重随机</FieldDescription>
							<FieldError id="advert-weight-error">{errors.weight}</FieldError>
						</FieldContent>
					</Field>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="advert-start-at">
							<FieldTitle>排期开始</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="advert-start-at"
								type="datetime-local"
								value={form.startAt}
								onChange={(event) => setField("startAt", event.target.value)}
								aria-invalid={errors.startAt ? true : undefined}
								aria-describedby={
									errors.startAt ? "advert-start-at-error" : undefined
								}
							/>
							<FieldDescription>留空 = 立即开始</FieldDescription>
							<FieldError id="advert-start-at-error">
								{errors.startAt}
							</FieldError>
						</FieldContent>
					</Field>

					<Field>
						<FieldLabel htmlFor="advert-end-at">
							<FieldTitle>排期结束</FieldTitle>
						</FieldLabel>
						<FieldContent>
							<Input
								id="advert-end-at"
								type="datetime-local"
								value={form.endAt}
								onChange={(event) => setField("endAt", event.target.value)}
								aria-invalid={errors.endAt ? true : undefined}
								aria-describedby={
									errors.endAt ? "advert-end-at-error" : undefined
								}
							/>
							<FieldDescription>留空 = 长期投放</FieldDescription>
							<FieldError id="advert-end-at-error">{errors.endAt}</FieldError>
						</FieldContent>
					</Field>
				</div>

				<Field>
					<FieldLabel htmlFor="advert-enabled">
						<FieldTitle>启用</FieldTitle>
					</FieldLabel>
					<FieldContent>
						<Toggle
							id="advert-enabled"
							variant="outline"
							size="sm"
							pressed={form.enabled}
							onPressedChange={(pressed) => setField("enabled", pressed)}
							aria-label="前台启用该广告"
							aria-describedby="advert-enabled-desc"
							className="justify-start w-full"
						>
							{form.enabled ? "已启用" : "已停用"}
						</Toggle>
						<FieldDescription id="advert-enabled-desc">
							关闭后前台立即不再展示（状态显示为「已停用」）
						</FieldDescription>
					</FieldContent>
				</Field>

				<FieldDescription>
					排期与设备定向由服务端过滤；同一广告位的候选素材多于展示位时按权重随机轮换，
					不多于展示位时按排序稳定展示。
				</FieldDescription>
			</div>
		</ConfirmDialog>
	);
}

// ── 素材删除 ──────────────────────────────────────────────────

function DeleteAdvertDialog({
	advert,
	open,
	onOpenChange,
}: {
	advert: Advert | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const mutation = useAdminMutation<{ success: boolean }, { advert: Advert }>({
		mutationKey: AD_MUTATION_KEY,
		mutationFn: async ({ advert: target }) => {
			const res = await adminDeleteAdvert({ data: { id: target.id } });
			if (!res?.success) throw new Error("删除广告失败");
			return res;
		},
		optimistic: (queryClient, { advert: target }) => {
			updateAdvertCaches(queryClient, (adverts) =>
				adverts.filter((item) => item.id !== target.id),
			);
			updatePublicAdvertCaches(queryClient, (publicAdvert) =>
				publicAdvert.id === target.id ? null : publicAdvert,
			);
			updateAdSlotCaches(queryClient, (slots) =>
				slots.map((slot) =>
					slot.id === target.slotId
						? {
								...slot,
								advertCount: Math.max(0, slot.advertCount - 1),
							}
						: slot,
				),
			);
		},
		affects: invalidations.adverts,
		successMessage: "广告已删除",
		onSuccess: () => onOpenChange(false),
	});

	if (!advert) return null;

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title="删除广告"
			desc={`确定要删除「${advert.name}」吗？删除后前台将立即不再展示，且无法恢复。`}
			destructive
			confirmText="确认删除"
			isLoading={mutation.isPending}
			onConfirm={() => mutation.mutate({ advert })}
		/>
	);
}
