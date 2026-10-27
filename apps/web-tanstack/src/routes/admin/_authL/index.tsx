import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { adminNav, adminQuickLinks } from "@web/components/admin/admin-nav";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { IconTile } from "@web/components/shared/icon-tile";
import { Skeleton } from "@web/components/ui/skeleton";
import { adminKeys } from "@web/lib/admin/query-keys";
import { cn } from "@web/lib/utils";
import { adminGetAllArticles } from "@web/server/admin/articles";
import { adminGetAllComments } from "@web/server/admin/comments";
import { adminGetAllTopics } from "@web/server/admin/topics";
import { adminListUsers } from "@web/server/auth/auth.functions";
import type { LucideIcon } from "lucide-react";
import {
	ArrowRightIcon,
	BarChart3Icon,
	ExternalLinkIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	MessageSquareTextIcon,
	MessagesSquareIcon,
	ShieldCheckIcon,
	UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/admin/_authL/")({
	component: RouteComponent,
});

// ─── 数据（数据来源与原先保持一致的 4 个接口） ──────────────

/** 统一读取分页接口的 total 字段，非数字一律返回 null */
async function readTotal(request: Promise<unknown>): Promise<number | null> {
	try {
		const response = await request;
		if (response && typeof response === "object" && "total" in response) {
			const total = (response as { total?: unknown }).total;
			return typeof total === "number" ? total : null;
		}
		return null;
	} catch {
		return null;
	}
}

type DashboardStats = {
	users: number | null;
	comments: number | null;
	articles: number | null;
	topics: number | null;
};

async function fetchDashboardStats(): Promise<DashboardStats> {
	const [users, comments, articles, topics] = await Promise.all([
		readTotal(adminListUsers({ data: { limit: 1, offset: 0 } })),
		readTotal(adminGetAllComments({ data: { page: 1, limit: 1 } })),
		readTotal(adminGetAllArticles({ data: { page: 1, limit: 1 } })),
		readTotal(adminGetAllTopics({ data: { page: 1, limit: 1 } })),
	]);
	return { users, comments, articles, topics };
}

function formatNumber(value: number | null | undefined): string {
	if (value == null) return "—";
	return value.toLocaleString("zh-CN");
}

// ─── KPI 卡 ──────────────────────────────────────────────────

function KpiCard({
	icon,
	label,
	value,
	description,
	loading,
}: {
	icon: LucideIcon;
	label: string;
	value: number | null;
	description: string;
	loading: boolean;
}) {
	return (
		<div className="flex gap-4 items-center p-5 bg-card rounded-2xl ring-1 ring-border/60 transition-colors duration-200 hover:ring-border">
			<IconTile icon={icon} size="md" />
			<div className="flex flex-col gap-0.5 min-w-0">
				<span className="text-xs font-medium text-muted-foreground">
					{label}
				</span>
				{loading ? (
					<Skeleton className="mt-1 w-16 h-7" />
				) : (
					<span className="text-2xl font-semibold tabular-nums tracking-tight">
						{formatNumber(value)}
					</span>
				)}
				<span className="text-xs text-muted-foreground/70 truncate">
					{description}
				</span>
			</div>
		</div>
	);
}

/** 迷你占比条：不引图表库，用它表达内容构成。 */
function MiniBar({
	value,
	tone = "primary",
}: {
	value: number;
	tone?: "primary" | "success" | "info";
}) {
	const width = Math.max(0, Math.min(100, value));
	const tones = {
		primary: "bg-primary",
		success: "bg-success",
		info: "bg-info",
	} as const;
	return (
		<div className="overflow-hidden w-full h-1.5 bg-muted rounded-full">
			<div
				className={cn("h-full rounded-full transition-[width]", tones[tone])}
				style={{ width: `${width}%` }}
			/>
		</div>
	);
}

// ─── 内容构成 ────────────────────────────────────────────────

function ContentMixCard({
	stats,
	loading,
}: {
	stats: DashboardStats | undefined;
	loading: boolean;
}) {
	const parts = [
		{
			key: "comments",
			label: "评论",
			value: stats?.comments ?? 0,
			icon: MessageSquareTextIcon,
			tone: "primary" as const,
		},
		{
			key: "articles",
			label: "攻略文章",
			value: stats?.articles ?? 0,
			icon: FileTextIcon,
			tone: "success" as const,
		},
		{
			key: "topics",
			label: "论坛话题",
			value: stats?.topics ?? 0,
			icon: MessagesSquareIcon,
			tone: "info" as const,
		},
	];
	const total = parts.reduce((sum, part) => sum + part.value, 0);

	return (
		<div className="flex flex-col gap-4 p-4 bg-card rounded-2xl ring-1 ring-border/60">
			<div className="flex gap-2.5 items-center">
				<IconTile icon={BarChart3Icon} size="sm" tone="muted" />
				<div>
					<p className="text-sm font-medium">内容构成</p>
					<p className="text-xs text-muted-foreground">
						{loading ? "统计中…" : `共 ${formatNumber(total)} 条内容`}
					</p>
				</div>
			</div>
			<div className="flex flex-col gap-3">
				{parts.map((part) => (
					<div key={part.key} className="flex flex-col gap-1">
						<div className="flex justify-between items-center text-xs">
							<span className="text-muted-foreground">{part.label}</span>
							<span className="font-medium tabular-nums">
								{loading ? "—" : formatNumber(part.value)}
							</span>
						</div>
						<MiniBar
							value={total > 0 ? (part.value / total) * 100 : 0}
							tone={part.tone}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── 快捷入口（由 admin-nav 单一配置源派生） ────────────────

function QuickLinks() {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex gap-2.5 items-center">
				<IconTile icon={LayoutDashboardIcon} size="sm" tone="muted" />
				<div>
					<h2 className="text-sm font-semibold">快捷入口</h2>
					<p className="text-xs text-muted-foreground">
						常用管理功能的直达入口
					</p>
				</div>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{adminQuickLinks.map(({ to, icon: Icon, label, description }) => (
					<Link
						key={to}
						to={to}
						className="group flex gap-3 items-center p-4 bg-card rounded-2xl ring-1 ring-border/60 transition-colors duration-200 hover:bg-muted/40 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
					>
						<IconTile
							icon={Icon}
							size="sm"
							tone="muted"
							className="transition-colors duration-200 group-hover:text-primary group-hover:bg-primary/10"
						/>
						<div className="flex flex-col flex-1 min-w-0">
							<span className="text-sm font-medium">{label}</span>
							<span className="text-xs text-muted-foreground truncate">
								{description}
							</span>
						</div>
						<ArrowRightIcon className="shrink-0 size-4 text-muted-foreground/50 transition-transform group-hover:text-foreground group-hover:translate-x-0.5" />
					</Link>
				))}
			</div>
		</section>
	);
}

// ─── 系统状态区块 ────────────────────────────────────────────

const systemItems =
	adminNav.find((section) => section.section === "系统")?.items ?? [];

function StatusRow({
	icon: Icon,
	title,
	description,
	children,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div className="flex gap-3 justify-between items-center px-3 py-2.5 rounded-xl transition-colors duration-200 hover:bg-muted/40">
			<div className="flex gap-3 items-center min-w-0">
				<IconTile icon={Icon} size="sm" tone="muted" />
				<div className="flex flex-col min-w-0">
					<span className="text-sm font-medium">{title}</span>
					<span className="text-xs text-muted-foreground truncate">
						{description}
					</span>
				</div>
			</div>
			{children}
		</div>
	);
}

const manageLinkClass =
	"shrink-0 px-1.5 py-0.5 text-xs font-medium text-primary rounded-md transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

function SystemStatus() {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex gap-2.5 items-center">
				<IconTile icon={ShieldCheckIcon} size="sm" tone="muted" />
				<div>
					<h2 className="text-sm font-semibold">系统状态</h2>
					<p className="text-xs text-muted-foreground">
						数据同步与站外服务入口
					</p>
				</div>
			</div>
			<div className="flex flex-col p-2 bg-card rounded-2xl ring-1 ring-border/60">
				{systemItems
					.filter((item) => item.to !== "/admin/users")
					.map(({ to, icon: Icon, label, description }) => (
						<StatusRow
							key={to}
							icon={Icon}
							title={label}
							description={description}
						>
							<Link to={to} className={manageLinkClass}>
								管理
							</Link>
						</StatusRow>
					))}
				<StatusRow
					icon={ExternalLinkIcon}
					title="前台站点"
					description="回到用户端浏览 GalZY"
				>
					<Link to="/" className={manageLinkClass}>
						查看
					</Link>
				</StatusRow>
			</div>
		</section>
	);
}

// ─── 页面 ────────────────────────────────────────────────────

function RouteComponent() {
	const { data: stats, isLoading } = useQuery({
		queryKey: adminKeys.dashboard(),
		queryFn: fetchDashboardStats,
		staleTime: 60_000,
	});

	const kpis: {
		key: string;
		label: string;
		icon: LucideIcon;
		value: number | null;
		description: string;
	}[] = [
		{
			key: "users",
			label: "注册用户",
			icon: UsersIcon,
			value: stats?.users ?? null,
			description: "含管理员与普通用户",
		},
		{
			key: "comments",
			label: "评论总数",
			icon: MessageSquareTextIcon,
			value: stats?.comments ?? null,
			description: "全站评论与回复",
		},
		{
			key: "articles",
			label: "攻略文章",
			icon: FileTextIcon,
			value: stats?.articles ?? null,
			description: "审核中与已发布",
		},
		{
			key: "topics",
			label: "论坛话题",
			icon: MessagesSquareIcon,
			value: stats?.topics ?? null,
			description: "含隐藏与待审核",
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={LayoutDashboardIcon}
				eyebrow="概览"
				title="仪表盘"
				description="欢迎回来，这里是站点的总览与管理入口"
			/>

			<div className="grid gap-3 lg:grid-cols-3">
				<div className="grid grid-cols-2 gap-3 lg:col-span-2">
					{kpis.map((kpi) => (
						<KpiCard
							key={kpi.key}
							icon={kpi.icon}
							label={kpi.label}
							value={kpi.value}
							description={kpi.description}
							loading={isLoading}
						/>
					))}
				</div>
				<ContentMixCard stats={stats} loading={isLoading} />
			</div>

			<QuickLinks />

			<SystemStatus />
		</div>
	);
}
