import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	StatusPill,
	Table,
	TableCard,
	TableEmpty,
	TablePagination,
	TableScroll,
	TableSkeleton,
	TableToolbar,
	TBody,
	Td,
	Th,
	THead,
	Tr,
	type StatusTone,
} from "@web/components/admin/admin-table";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
import { SearchField } from "@web/components/shared/search-field";
import { AdminUserTooltip } from "@web/components/admin/admin-user-tooltip";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import {
	adminChangeArticleStatus,
	adminGetAllArticles,
} from "@web/server/admin/articles";
import {
	CircleCheckIcon,
	EyeOffIcon,
	FileTextIcon,
	Loader2Icon,
	PencilIcon,
	SearchIcon,
	Trash2Icon,
	Undo2Icon,
	XCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface AdminArticleUser {
	id: string;
	name: string;
	email?: string | null;
	image?: string | null;
}

interface AdminArticle {
	id: number;
	vid: string | null;
	otherid: number | null;
	author: string;
	title: string | null;
	content: string | null;
	type: string;
	status: string;
	copyright: string | null;
	createdAt: Date;
	updatedAt: Date;
	user?: AdminArticleUser | null;
}

const PAGE_SIZE = 20;

export default function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={FileTextIcon}
				eyebrow="内容管理"
				title="文章管理"
				description="管理全站攻略文章，支持审核、编辑、隐藏与删除操作"
			/>

			<ArticlesTable />
		</div>
	);
}

function ArticlesTable() {
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [typeFilter, setTypeFilter] = useState("");
	const [offset, setOffset] = useState(0);

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: [
			"admin-all-articles",
			{
				searchValue: search,
				status: statusFilter,
				type: typeFilter,
				offset,
				limit: PAGE_SIZE,
			},
		],
		queryFn: async () => {
			const res = await adminGetAllArticles({
				data: {
					page: Math.floor(offset / PAGE_SIZE) + 1,
					limit: PAGE_SIZE,
					search: search || undefined,
					status: statusFilter || undefined,
					type: typeFilter || undefined,
				},
			});
			return res as unknown as {
				articles: AdminArticle[];
				total: number;
				totalPages: number;
			};
		},
	});

	useEffect(() => {
		if (error) {
			toast.error(error instanceof Error ? error.message : "获取文章列表出错");
		}
	}, [error]);

	const articles = data?.articles ?? [];
	const total = data?.total ?? 0;

	const handleSearch = () => {
		setOffset(0);
		setSearch(searchInput);
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

	const refresh = () => refetch();

	const statusLabel: Record<string, { label: string; tone: StatusTone }> = {
		published: { label: "已审核", tone: "success" },
		pending: { label: "待审核", tone: "warning" },
		rejected: { label: "已驳回", tone: "destructive" },
		hidden: { label: "隐藏", tone: "neutral" },
		deleted: { label: "已删除", tone: "destructive" },
	};

	const typeLabel: Record<string, string> = {
		strategy: "攻略",
		blog: "博客",
		tutorial: "教程",
	};

	return (
		<TableCard>
			<TableToolbar>
				<SearchField
					value={searchInput}
					onChange={setSearchInput}
					onSubmit={handleSearch}
					placeholder="搜索文章标题…"
					ariaLabel="搜索文章标题"
					className="sm:max-w-xs"
				/>
				<Select
					value={statusFilter}
					onValueChange={(v) => {
						setStatusFilter((v ?? "") === "__all__" ? "" : (v ?? ""));
						setOffset(0);
					}}
				>
					<SelectTrigger className="w-28">
						<SelectValue placeholder="状态" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all__">全部状态</SelectItem>
						<SelectItem value="pending">待审核</SelectItem>
						<SelectItem value="published">已审核</SelectItem>
						<SelectItem value="rejected">已驳回</SelectItem>
						<SelectItem value="hidden">已隐藏</SelectItem>
						<SelectItem value="deleted">已删除</SelectItem>
					</SelectContent>
				</Select>
				<Select
					value={typeFilter}
					onValueChange={(v) => {
						setTypeFilter((v ?? "") === "__all__" ? "" : (v ?? ""));
						setOffset(0);
					}}
				>
					<SelectTrigger className="w-28">
						<SelectValue placeholder="类型" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all__">全部类型</SelectItem>
						<SelectItem value="strategy">攻略</SelectItem>
						<SelectItem value="blog">博客</SelectItem>
						<SelectItem value="tutorial">教程</SelectItem>
					</SelectContent>
				</Select>
				<Button variant="outline" onClick={handleSearch} disabled={isLoading}>
					<SearchIcon className="size-4" />
					搜索
				</Button>
			</TableToolbar>

			<TableScroll>
				<Table minWidth="min-w-[960px]">
					<THead>
						<Tr>
							<Th>标题</Th>
							<Th>作者</Th>
							<Th>所属游戏</Th>
							<Th>类型</Th>
							<Th>状态</Th>
							<Th>时间</Th>
							<Th align="right">操作</Th>
						</Tr>
					</THead>
					{isLoading ? (
						<TableSkeleton columns={7} />
					) : articles.length === 0 ? (
						<tbody>
							<TableEmpty
								colSpan={7}
								icon={FileTextIcon}
								title="暂无文章数据"
								description="调整筛选条件，或等待作者投稿"
							/>
						</tbody>
					) : (
						<TBody>
							{articles.map((article) => {
								const sl = statusLabel[article.status] ?? {
									label: article.status,
									tone: "neutral" as const,
								};
								const gameId = article.vid ?? String(article.otherid ?? "");
								return (
									<Tr key={article.id}>
										<Td className="max-w-xs">
											<span className="text-sm font-medium truncate block">
												{article.title || "无标题"}
											</span>
										</Td>
										<Td>
											<AdminUserTooltip
												user={article.user}
												className="text-sm text-muted-foreground"
											/>
										</Td>
										<Td>
											<span className="text-xs text-muted-foreground">
												{gameId || "-"}
											</span>
										</Td>
										<Td>
											<Badge variant="secondary" className="text-xs">
												{typeLabel[article.type] || article.type}
											</Badge>
										</Td>
										<Td>
											<StatusPill tone={sl.tone}>{sl.label}</StatusPill>
										</Td>
										<Td className="text-xs whitespace-nowrap text-muted-foreground">
											{new Date(article.createdAt).toLocaleDateString("zh-CN")}
										</Td>
										<Td align="right">
											<div className="flex items-center justify-end gap-1.5">
												<EditArticleCell article={article} />
												{article.status !== "published" && (
													<PublishArticleButton
														article={article}
														onDone={refresh}
													/>
												)}
												{article.status === "pending" && (
													<RejectArticleButton
														article={article}
														onDone={refresh}
													/>
												)}
												{article.status === "published" && (
													<HideArticleButton
														article={article}
														onDone={refresh}
													/>
												)}
												{article.status === "hidden" && (
													<RestoreArticleButton
														article={article}
														onDone={refresh}
													/>
												)}
												<DeleteArticleDialog
													article={article}
													onDone={refresh}
												/>
											</div>
										</Td>
									</Tr>
								);
							})}
						</TBody>
					)}
				</Table>
			</TableScroll>

			<TablePagination
				page={currentPage}
				totalPages={totalPages}
				totalItems={total}
				onPageChange={(next) => setOffset((next - 1) * PAGE_SIZE)}
			/>
		</TableCard>
	);
}

function EditArticleCell({ article }: { article: AdminArticle }) {
	const navigate = useNavigate();

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={() => {
				navigate({
					to: "/admin/articles/$articleId/edit",
					params: { articleId: String(article.id) },
				});
			}}
		>
			<PencilIcon className="size-4" />
		</Button>
	);
}

function PublishArticleButton({
	article,
	onDone,
}: {
	article: AdminArticle;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handlePublish = async () => {
		setLoading(true);
		try {
			const res = await adminChangeArticleStatus({
				data: { id: article.id, status: "published" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("文章已审核通过");
			onDone();
		} catch {
			toast.error("操作出错");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={handlePublish}
			disabled={loading}
		>
			{loading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : (
				<CircleCheckIcon className="size-4 text-success" />
			)}
		</Button>
	);
}

function RejectArticleButton({
	article,
	onDone,
}: {
	article: AdminArticle;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleReject = async () => {
		setLoading(true);
		try {
			const res = await adminChangeArticleStatus({
				data: { id: article.id, status: "rejected" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("文章已驳回");
			onDone();
		} catch {
			toast.error("操作出错");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button variant="ghost" size="sm" onClick={handleReject} disabled={loading}>
			{loading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : (
				<XCircleIcon className="size-4 text-destructive" />
			)}
		</Button>
	);
}

function HideArticleButton({
	article,
	onDone,
}: {
	article: AdminArticle;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleHide = async () => {
		setLoading(true);
		try {
			const res = await adminChangeArticleStatus({
				data: { id: article.id, status: "hidden" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("文章已隐藏");
			onDone();
		} catch {
			toast.error("操作出错");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button variant="ghost" size="sm" onClick={handleHide} disabled={loading}>
			{loading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : (
				<EyeOffIcon className="size-4 text-muted-foreground" />
			)}
		</Button>
	);
}

function RestoreArticleButton({
	article,
	onDone,
}: {
	article: AdminArticle;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleRestore = async () => {
		setLoading(true);
		try {
			const res = await adminChangeArticleStatus({
				data: { id: article.id, status: "published" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("文章已恢复");
			onDone();
		} catch {
			toast.error("操作出错");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={handleRestore}
			disabled={loading}
		>
			{loading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : (
				<Undo2Icon className="size-4 text-success" />
			)}
		</Button>
	);
}

function DeleteArticleDialog({
	article,
	onDone,
}: {
	article: AdminArticle;
	onDone: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const handleDelete = async () => {
		setSubmitting(true);
		try {
			const res = await adminChangeArticleStatus({
				data: { id: article.id, status: "deleted" },
			});
			if (!res) {
				toast.error("删除文章失败");
				return;
			}
			toast.success("文章已删除");
			setOpen(false);
			onDone();
		} catch {
			toast.error("删除文章出错");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
				<Trash2Icon className="size-4 text-destructive" />
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>删除文章</DialogTitle>
					<DialogDescription>
						此操作将软删除该文章，将其状态标记为"已删除"。
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">确定要删除此文章吗？</p>
					<blockquote className="text-sm border-l-2 pl-3 text-muted-foreground italic">
						{article.title || "无标题"}
					</blockquote>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={submitting}
					>
						取消
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={submitting}
					>
						{submitting && <Loader2Icon className="size-4 animate-spin" />}
						确认删除
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
