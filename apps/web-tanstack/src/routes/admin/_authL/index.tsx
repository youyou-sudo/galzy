import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { adminNav, adminNavItems } from "@web/components/admin/admin-nav";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Skeleton } from "@web/components/ui/skeleton";
import { adminGetAllArticles } from "@web/server/admin/articles";
import { adminGetAllComments } from "@web/server/admin/comments";
import { adminGetAllTopics } from "@web/server/admin/topics";
import { adminListUsers } from "@web/server/auth/auth.functions";
import {
	ArrowRightIcon,
	ExternalLinkIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	MessageSquareTextIcon,
	ShieldCheckIcon,
	UsersIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export const Route = createFileRoute("/admin/_authL/")({
	component: RouteComponent,
});

// --- 统计卡片 ---

type StatKey = "users" | "comments" | "articles" | "topics";

/** 统一读取分页接口的 total 字段,非数字一律返回 null */
async function readTotal(request: Promise<unknown>): Promise<number | null> {
	const res = await request;
	if (res && typeof res === "object" && "total" in res) {
		const total = (res as { total?: unknown }).total;
		return typeof total === "number" ? total : null;
	}
	return null;
}

const statDefs: {
	key: StatKey;
	label: string;
	icon: ComponentType<{ className?: string }>;
	query: () => Promise<number | null | undefined>;
}[] = [
	{
		key: "users",
		label: "注册用户",
		icon: UsersIcon,
		query: () => readTotal(adminListUsers({ data: { limit: 1, offset: 0 } })),
	},
	{
		key: "comments",
		label: "评论总数",
		icon: MessageSquareTextIcon,
		query: () =>
			readTotal(adminGetAllComments({ data: { page: 1, limit: 1 } })),
	},
	{
		key: "articles",
		label: "攻略文章",
		icon: FileTextIcon,
		query: () =>
			readTotal(adminGetAllArticles({ data: { page: 1, limit: 1 } })),
	},
	{
		key: "topics",
		label: "论坛话题",
		icon: MessageSquareTextIcon,
		query: () => readTotal(adminGetAllTopics({ data: { page: 1, limit: 1 } })),
	},
];

function StatGrid() {
	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			{statDefs.map(({ key, label, icon: Icon, query }) => (
				<StatCard key={key} label={label} icon={Icon} query={query} />
			))}
		</div>
	);
}

function StatCard({
	label,
	icon: Icon,
	query,
}: {
	label: string;
	icon: ComponentType<{ className?: string }>;
	query: () => Promise<number | null | undefined>;
}) {
	const { data, isLoading } = useQuery({
		queryKey: ["admin-stats", label],
		queryFn: async () => {
			try {
				return (await query()) ?? null;
			} catch {
				return null;
			}
		},
		staleTime: 60_000,
	});

	return (
		<Card>
			<CardContent className="flex items-center gap-4 p-5">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary ring-1 ring-primary/10">
					<Icon className="size-5" />
				</div>
				<div className="flex min-w-0 flex-col">
					<span className="text-xs font-medium text-muted-foreground">
						{label}
					</span>
					{isLoading ? (
						<Skeleton className="mt-1.5 h-7 w-16" />
					) : (
						<span className="text-2xl font-semibold tabular-nums tracking-tight">
							{data ?? "—"}
						</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

// --- 快捷入口 ---

// 除仪表盘外全部导航项,由 admin-nav 单一配置源派生
const quickLinks = adminNavItems.filter((item) => item.to !== "/admin");

function QuickLinksCard() {
	return (
		<Card className="lg:col-span-3">
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<LayoutDashboardIcon className="size-4 text-muted-foreground" />
					快捷入口
				</CardTitle>
				<CardDescription>常用管理功能的直达入口</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-1.5 sm:grid-cols-2">
				{quickLinks.map(({ to, icon: Icon, label, description }) => (
					<Link
						key={to}
						to={to}
						className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/50"
					>
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
							<Icon className="size-4" />
						</div>
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="text-sm font-medium">{label}</span>
							<span className="truncate text-xs text-muted-foreground">
								{description}
							</span>
						</div>
						<ArrowRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
					</Link>
				))}
			</CardContent>
		</Card>
	);
}

// --- 系统状态 ---

// 「系统」分组中除用户管理外的导航项,由 admin-nav 单一配置源派生
const systemStatusItems =
	adminNav.find((section) => section.section === "系统")?.items ?? [];

function StatusRow({
	icon: Icon,
	title,
	description,
	children,
}: {
	icon: ComponentType<{ className?: string }>;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50">
			<div className="flex min-w-0 items-center gap-3">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
					<Icon className="size-4" />
				</div>
				<div className="flex min-w-0 flex-col">
					<span className="text-sm font-medium">{title}</span>
					<span className="truncate text-xs text-muted-foreground">
						{description}
					</span>
				</div>
			</div>
			{children}
		</div>
	);
}

function SystemStatusCard() {
	return (
		<Card className="lg:col-span-2">
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<ShieldCheckIcon className="size-4 text-muted-foreground" />
					系统状态
				</CardTitle>
				<CardDescription>数据同步与站外服务入口</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-1.5">
				{systemStatusItems
					.filter((item) => item.to !== "/admin/users")
					.map(({ to, icon: Icon, label, description }) => (
						<StatusRow
							key={to}
							icon={Icon}
							title={label}
							description={description}
						>
							<Link
								to={to}
								className="text-xs font-medium text-primary hover:underline"
							>
								管理
							</Link>
						</StatusRow>
					))}
				<StatusRow
					icon={ExternalLinkIcon}
					title="前台站点"
					description="回到用户端浏览 GalZY"
				>
					<Link
						to="/"
						className="text-xs font-medium text-primary hover:underline"
					>
						查看
					</Link>
				</StatusRow>
			</CardContent>
		</Card>
	);
}

// --- 页面 ---

function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				eyebrow="概览"
				title="仪表盘"
				description="欢迎回来，这里是站点的总览与管理入口"
			/>
			<StatGrid />
			<div className="grid gap-6 lg:grid-cols-5">
				<QuickLinksCard />
				<SystemStatusCard />
			</div>
		</div>
	);
}
