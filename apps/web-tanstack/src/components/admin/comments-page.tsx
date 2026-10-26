import { useQuery } from "@tanstack/react-query";
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
import { Label } from "@web/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import { Textarea } from "@web/components/ui/textarea";
import {
	adminChangeCommentStatus,
	adminDeleteComment,
	adminGetAllComments,
	adminTogglePin,
	adminUpdateComment,
} from "@web/server/admin/comments";
import {
	CornerDownRightIcon,
	ExternalLinkIcon,
	Loader2Icon,
	MessageSquareIcon,
	PencilIcon,
	PinIcon,
	PinOffIcon,
	ReplyIcon,
	SearchIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CommentUser {
	id: string;
	name: string;
	email: string;
	image?: string | null;
}

interface AdminComment {
	id: string;
	targetType: string;
	targetId: string;
	userId: string;
	content: string;
	type: string;
	status: string;
	isPinned: boolean;
	parentId: string | null;
	rootId: string | null;
	depth: number;
	replyToUserId: string | null;
	createdAt: Date;
	updatedAt: Date;
	user?: CommentUser | null;
}

const PAGE_SIZE = 20;

export default function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={MessageSquareIcon}
				eyebrow="内容管理"
				title="评论管理"
				description="管理全站评论与回复，支持编辑、删除、状态变更与置顶操作"
			/>

			<CommentsTable />
		</div>
	);
}

function getTargetUrl(comment: AdminComment): string | null {
	if (comment.targetType === "game") {
		return `/${comment.targetId}`;
	}
	return null;
}

function CommentsTable() {
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [typeFilter, setTypeFilter] = useState("");
	const [excludeReplies, setExcludeReplies] = useState(false);
	const [offset, setOffset] = useState(0);

	const { data, isLoading, error, refetch } = useQuery({
		queryKey: [
			"admin-all-comments",
			{
				searchValue: search,
				status: statusFilter,
				type: typeFilter,
				excludeReplies,
				offset,
				limit: PAGE_SIZE,
			},
		],
		queryFn: async () => {
			const res = await adminGetAllComments({
				data: {
					page: Math.floor(offset / PAGE_SIZE) + 1,
					limit: PAGE_SIZE,
					targetId: search || undefined,
					status: statusFilter || undefined,
					type: typeFilter || undefined,
					excludeReplies: excludeReplies || undefined,
				},
			});
			return res as unknown as {
				comments: AdminComment[];
				total: number;
				totalPages: number;
			};
		},
	});

	useEffect(() => {
		if (error) {
			toast.error(error instanceof Error ? error.message : "获取评论列表出错");
		}
	}, [error]);

	const comments = data?.comments ?? [];
	const total = data?.total ?? 0;

	const handleSearch = () => {
		setOffset(0);
		setSearch(searchInput);
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

	const refresh = () => refetch();

	const statusLabel: Record<string, { label: string; tone: StatusTone }> = {
		normal: { label: "正常", tone: "success" },
		hidden: { label: "隐藏", tone: "warning" },
		deleted: { label: "已删除", tone: "destructive" },
	};

	const typeLabel: Record<string, string> = {
		comment: "讨论",
		feedback: "反馈",
		question: "提问",
	};

	return (
		<TableCard>
			<TableToolbar>
				<SearchField
					value={searchInput}
					onChange={setSearchInput}
					onSubmit={handleSearch}
					placeholder="搜索目标 ID…"
					ariaLabel="搜索评论目标 ID"
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
						<SelectItem value="normal">正常</SelectItem>
						<SelectItem value="hidden">隐藏</SelectItem>
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
						<SelectItem value="comment">讨论</SelectItem>
						<SelectItem value="feedback">反馈</SelectItem>
						<SelectItem value="question">提问</SelectItem>
					</SelectContent>
				</Select>
				<Button
					variant={excludeReplies ? "secondary" : "outline"}
					onClick={() => {
						setExcludeReplies(!excludeReplies);
						setOffset(0);
					}}
					className="whitespace-nowrap"
				>
					一级评论
				</Button>
				<Button variant="outline" onClick={handleSearch} disabled={isLoading}>
					<SearchIcon className="size-4" />
					搜索
				</Button>
			</TableToolbar>

			<TableScroll>
				<Table minWidth="min-w-[980px]">
					<THead>
						<Tr>
							<Th>用户</Th>
							<Th>内容</Th>
							<Th>目标</Th>
							<Th>类型</Th>
							<Th>状态</Th>
							<Th>时间</Th>
							<Th align="right">操作</Th>
						</Tr>
					</THead>
					{isLoading ? (
						<TableSkeleton columns={7} />
					) : comments.length === 0 ? (
						<tbody>
							<TableEmpty
								colSpan={7}
								icon={MessageSquareIcon}
								title="暂无评论数据"
								description="调整筛选条件后再试"
							/>
						</tbody>
					) : (
						<TBody>
							{comments.map((comment) => {
								const sl = statusLabel[comment.status] ?? {
									label: comment.status,
									tone: "neutral" as const,
								};
								const isReply = comment.depth > 0;
								const targetUrl = getTargetUrl(comment);
								return (
									<Tr key={comment.id} muted={isReply}>
										<Td>
											<div className="flex gap-2 items-center">
												{isReply && (
													<CornerDownRightIcon className="shrink-0 size-3.5 text-muted-foreground" />
												)}
												<AdminUserTooltip
													user={comment.user}
													className="text-sm font-medium"
												/>
											</div>
											{isReply && (
												<span className="block mt-0.5 text-[11px] text-muted-foreground">
													回复 #{comment.parentId?.slice(0, 8)}
												</span>
											)}
										</Td>
										<Td className="max-w-xs">
											<div className="flex gap-1 items-start">
												{isReply && (
													<ReplyIcon className="shrink-0 mt-1 size-3 text-muted-foreground" />
												)}
												<p
													className={`text-sm truncate ${
														isReply
															? "text-muted-foreground"
															: "text-foreground"
													}`}
												>
													{comment.content}
												</p>
											</div>
										</Td>
										<Td>
											{targetUrl ? (
												<a
													href={targetUrl}
													target="_blank"
													rel="noreferrer"
													className="inline-flex gap-1 items-center text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80"
												>
													{comment.targetType}/{comment.targetId?.slice(0, 8)}
													<ExternalLinkIcon className="shrink-0 size-3" />
												</a>
											) : (
												<span className="text-xs text-muted-foreground">
													{comment.targetType}/{comment.targetId?.slice(0, 8)}
												</span>
											)}
										</Td>
										<Td>
											<Badge variant="secondary" className="text-xs">
												{typeLabel[comment.type] || comment.type}
											</Badge>
										</Td>
										<Td>
											<StatusPill tone={sl.tone}>{sl.label}</StatusPill>
										</Td>
										<Td className="text-xs text-muted-foreground whitespace-nowrap">
											{new Date(comment.createdAt).toLocaleDateString("zh-CN")}
										</Td>
										<Td align="right">
											<div className="flex gap-1.5 justify-end items-center">
												<EditCommentDialog comment={comment} onDone={refresh} />
												<TogglePinButton comment={comment} onDone={refresh} />
												{comment.status !== "hidden" && (
													<HideCommentButton
														comment={comment}
														onDone={refresh}
													/>
												)}
												{comment.status === "hidden" && (
													<UnhideCommentButton
														comment={comment}
														onDone={refresh}
													/>
												)}
												<DeleteCommentDialog
													comment={comment}
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

function EditCommentDialog({
	comment,
	onDone,
}: {
	comment: AdminComment;
	onDone: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [content, setContent] = useState(comment.content);
	const [submitting, setSubmitting] = useState(false);

	const handleEdit = async () => {
		if (!content.trim()) {
			toast.error("内容不能为空");
			return;
		}

		setSubmitting(true);
		try {
			const res = await adminUpdateComment({
				data: { id: comment.id, content },
			});
			if (!res) {
				toast.error("编辑评论失败");
				return;
			}
			toast.success("评论已更新");
			setOpen(false);
			onDone();
		} catch {
			toast.error("编辑评论出错");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (v) setContent(comment.content);
			}}
		>
			<Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
				<PencilIcon className="size-4" />
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>编辑评论</DialogTitle>
					<DialogDescription>修改评论内容</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-content">内容</Label>
						<Textarea
							id="edit-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={4}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setOpen(false)}
						disabled={submitting}
					>
						取消
					</Button>
					<Button onClick={handleEdit} disabled={submitting}>
						{submitting && <Loader2Icon className="size-4 animate-spin" />}
						保存
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function TogglePinButton({
	comment,
	onDone,
}: {
	comment: AdminComment;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleToggle = async () => {
		setLoading(true);
		try {
			const res = await adminTogglePin({ data: { id: comment.id } });
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success(comment.isPinned ? "已取消置顶" : "已置顶");
			onDone();
		} catch {
			toast.error("操作出错");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button variant="ghost" size="sm" onClick={handleToggle} disabled={loading}>
			{loading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : comment.isPinned ? (
				<PinOffIcon className="size-4 text-warning" />
			) : (
				<PinIcon className="size-4 text-muted-foreground" />
			)}
		</Button>
	);
}

function HideCommentButton({
	comment,
	onDone,
}: {
	comment: AdminComment;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleHide = async () => {
		setLoading(true);
		try {
			const res = await adminChangeCommentStatus({
				data: { id: comment.id, status: "hidden" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("评论已隐藏");
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
				<span className="text-xs text-muted-foreground">隐藏</span>
			)}
		</Button>
	);
}

function UnhideCommentButton({
	comment,
	onDone,
}: {
	comment: AdminComment;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleUnhide = async () => {
		setLoading(true);
		try {
			const res = await adminChangeCommentStatus({
				data: { id: comment.id, status: "normal" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("评论已恢复");
			onDone();
		} catch {
			toast.error("操作出错");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button variant="ghost" size="sm" onClick={handleUnhide} disabled={loading}>
			{loading ? (
				<Loader2Icon className="size-4 animate-spin" />
			) : (
				<span className="text-xs text-success">恢复</span>
			)}
		</Button>
	);
}

function DeleteCommentDialog({
	comment,
	onDone,
}: {
	comment: AdminComment;
	onDone: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const handleDelete = async () => {
		setSubmitting(true);
		try {
			const res = await adminDeleteComment({ data: { id: comment.id } });
			if (!res) {
				toast.error("删除评论失败");
				return;
			}
			toast.success("评论已删除");
			setOpen(false);
			onDone();
		} catch {
			toast.error("删除评论出错");
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
					<DialogTitle>删除评论</DialogTitle>
					<DialogDescription>
						此操作将软删除该评论，将其状态标记为"已删除"。
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">确定要删除此评论吗？</p>
					<blockquote className="pl-3 text-sm italic text-muted-foreground border-l-2">
						{comment.content.slice(0, 100)}
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
