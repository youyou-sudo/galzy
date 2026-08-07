import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
	DatabaseIcon,
	ExternalLinkIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	MessageSquareTextIcon,
	PackageIcon,
	SearchIcon,
	ShieldCheckIcon,
	UsersIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export const Route = createFileRoute("/admin/_authL/")({
	component: RouteComponent,
});

// --- 统计卡片 ---

type StatKey = "users" | "comments" | "articles" | "topics";

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
		query: async () => {
			const res = await adminListUsers({ data: { limit: 1, offset: 0 } });
			if (
				res &&
				typeof res === "object" &&
				"total" in res &&
				typeof res.total === "number"
			) {
				return res.total;
			}
			return null;
		},
	},
	{
		key: "comments",
		label: "评论总数",
		icon: MessageSquareTextIcon,
		query: async () => {
			const res = await adminGetAllComments({ data: { page: 1, limit: 1 } });
			if (
				res &&
				typeof res === "object" &&
				"total" in res &&
				typeof res.total === "number"
			) {
				return res.total;
			}
			return null;
		},
	},
	{
		key: "articles",
		label: "攻略文章",
		icon: FileTextIcon,
		query: async () => {
			const res = await adminGetAllArticles({ data: { page: 1, limit: 1 } });
			return res?.total ?? null;
		},
	},
	{
		key: "topics",
		label: "论坛话题",
		icon: MessageSquareTextIcon,
		query: async () => {
			const res = await adminGetAllTopics({ data: { page: 1, limit: 1 } });
			return res?.total ?? null;
		},
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

const adminLinks: {
	to: string;
	icon: ComponentType<{ className?: string }>;
	title: string;
	description: string;
}[] = [
	{
		to: "/admin/users",
		icon: UsersIcon,
		title: "用户管理",
		description: "账号、角色、封禁与权限",
	},
	{
		to: "/admin/comments",
		icon: MessageSquareTextIcon,
		title: "评论管理",
		description: "删除、编辑、隐藏与置顶",
	},
	{
		to: "/admin/articles",
		icon: FileTextIcon,
		title: "文章管理",
		description: "审核、编辑、隐藏与删除",
	},
	{
		to: "/admin/topics",
		icon: MessageSquareTextIcon,
		title: "话题管理",
		description: "审核、隐藏与删除",
	},
	{
		to: "/admin/collections",
		icon: PackageIcon,
		title: "合集管理",
		description: "手动选品与会社绑定",
	},
	{
		to: "/admin/meilisearch",
		icon: SearchIcon,
		title: "Meilisearch",
		description: "索引、搜索属性与 Embedders",
	},
	{
		to: "/admin/vndb-sync",
		icon: DatabaseIcon,
		title: "VNDB 数据同步",
		description: "全量/增量同步与监控",
	},
];

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
				{adminLinks.map(({ to, icon: Icon, title, description }) => (
					<Link
						key={to}
						to={to}
						className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-accent/50"
					>
						<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
							<Icon className="size-4" />
						</div>
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="text-sm font-medium">{title}</span>
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
				<StatusRow
					icon={SearchIcon}
					title="Meilisearch 索引"
					description="索引配置、搜索属性与 Embedders"
				>
					<Link
						to="/admin/meilisearch"
						className="text-xs font-medium text-primary hover:underline"
					>
						管理
					</Link>
				</StatusRow>
				<StatusRow
					icon={DatabaseIcon}
					title="VNDB 数据同步"
					description="全量 / 增量 / 开发者同步"
				>
					<Link
						to="/admin/vndb-sync"
						className="text-xs font-medium text-primary hover:underline"
					>
						管理
					</Link>
				</StatusRow>
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
