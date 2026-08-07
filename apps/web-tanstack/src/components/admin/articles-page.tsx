import { useQuery } from "@tanstack/react-query";
import { CreateEditDialog } from "@web/components/-CreateEditDialog";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@web/components/ui/dialog";
import { Input } from "@web/components/ui/input";
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
	adminUpdateArticle,
} from "@web/server/admin/articles";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	CircleCheckIcon,
	EyeOffIcon,
	FileTextIcon,
	Loader2Icon,
	PencilIcon,
	SearchIcon,
	Trash2Icon,
	Undo2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface AdminArticleUser {
	id: string;
	name: string;
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
		<div className="mx-auto w-full max-w-4xl space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">文章管理</h1>
					<p className="text-muted-foreground mt-1">
						管理全站攻略文章，支持审核、编辑、隐藏与删除操作
					</p>
				</div>
			</div>

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

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleSearch();
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

	const goNext = () => {
		if (currentPage < totalPages) {
			setOffset(offset + PAGE_SIZE);
		}
	};

	const goPrev = () => {
		if (currentPage > 1) {
			setOffset(Math.max(0, offset - PAGE_SIZE));
		}
	};

	const refresh = () => refetch();

	const statusLabel: Record<
		string,
		{
			label: string;
			variant: "default" | "secondary" | "destructive" | "outline";
		}
	> = {
		published: { label: "已审核", variant: "default" as const },
		hidden: { label: "隐藏", variant: "secondary" as const },
		deleted: { label: "已删除", variant: "destructive" as const },
	};

	const typeLabel: Record<string, string> = {
		strategy: "攻略",
		blog: "博客",
		tutorial: "教程",
	};

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
					<div className="relative flex-1">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							placeholder="搜索文章标题..."
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							onKeyDown={handleKeyDown}
							className="pl-9"
						/>
					</div>
					<Select
						value={statusFilter}
						onValueChange={(v) => {
							setStatusFilter(v === "__all__" ? "" : v);
							setOffset(0);
						}}
					>
						<SelectTrigger className="w-28">
							<SelectValue placeholder="状态" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="__all__">全部状态</SelectItem>
							<SelectItem value="published">已审核</SelectItem>
							<SelectItem value="hidden">已隐藏</SelectItem>
							<SelectItem value="deleted">已删除</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={typeFilter}
						onValueChange={(v) => {
							setTypeFilter(v === "__all__" ? "" : v);
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
						搜索
					</Button>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{isLoading ? (
					<div className="flex items-center justify-center py-16">
						<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : articles.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
						<FileTextIcon className="size-10 mb-2" />
						<p className="text-sm">暂无文章数据</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										标题
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										作者
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										所属游戏
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										类型
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										状态
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										时间
									</th>
									<th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
										操作
									</th>
								</tr>
							</thead>
							<tbody>
								{articles.map((article) => {
									const sl = statusLabel[article.status] ?? {
										label: article.status,
										variant: "secondary" as const,
									};
									const gameId = article.vid ?? String(article.otherid ?? "");
									return (
										<tr
											key={article.id}
											className="border-b last:border-0 hover:bg-muted/30 transition-colors"
										>
											<td className="px-4 py-3 max-w-xs">
												<span className="text-sm font-medium truncate block">
													{article.title || "无标题"}
												</span>
											</td>
											<td className="px-4 py-3">
												<span className="text-sm text-muted-foreground">
													{article.user?.name || "未知"}
												</span>
											</td>
											<td className="px-4 py-3">
												<span className="text-xs text-muted-foreground">
													{gameId || "-"}
												</span>
											</td>
											<td className="px-4 py-3">
												<Badge variant="secondary" className="text-xs">
													{typeLabel[article.type] || article.type}
												</Badge>
											</td>
											<td className="px-4 py-3">
												<Badge variant={sl.variant}>{sl.label}</Badge>
											</td>
											<td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
												{new Date(article.createdAt).toLocaleDateString(
													"zh-CN",
												)}
											</td>
											<td className="px-4 py-3 text-right">
												<div className="flex items-center justify-end gap-1.5">
													<EditArticleCell article={article} onDone={refresh} />
													{article.status !== "published" && (
														<PublishArticleButton
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
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between px-4 py-3 border-t">
					<span className="text-xs text-muted-foreground">
						共 {total} 篇文章 · 第 {currentPage}/{totalPages} 页
					</span>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={goPrev}
							disabled={currentPage <= 1}
						>
							<ChevronLeftIcon className="size-4" />
							上一页
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={goNext}
							disabled={currentPage >= totalPages}
						>
							下一页
							<ChevronRightIcon className="size-4" />
						</Button>
					</div>
				</div>
			)}
		</Card>
	);
}

function EditArticleCell({
	article,
	onDone,
}: {
	article: AdminArticle;
	onDone: () => void;
}) {
	const [open, setOpen] = useState(false);

	const handleCustomSubmit = async (values: {
		id?: string | number;
		title: string;
		content: string;
		copyright?: string;
	}) => {
		try {
			await adminUpdateArticle({
				data: {
					id: Number(values.id),
					title: values.title,
					content: values.content,
				},
			});
			toast.success("文章已更新");
			setOpen(false);
			onDone();
		} catch {
			toast.error("文章更新失败");
		}
	};

	return (
		<>
			<Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
				<PencilIcon className="size-4" />
			</Button>
			<CreateEditDialog
				open={open}
				onOpenChange={setOpen}
				initialData={{
					id: article.id,
					title: article.title ?? "",
					content: article.content ?? "",
				}}
				customSubmit={handleCustomSubmit}
			/>
		</>
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
				<CircleCheckIcon className="size-4 text-green-600" />
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
				<Undo2Icon className="size-4 text-green-600" />
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
						{submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
						确认删除
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
