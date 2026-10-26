import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
	adminDeleteTopic,
	adminGetAllTopics,
	adminUpdateTopicStatus,
} from "@web/server/admin/topics";
import {
	ExternalLinkIcon,
	Loader2Icon,
	MessageSquareTextIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface TopicUser {
	id: string;
	name: string;
	image?: string | null;
}

interface AdminTopic {
	id: number;
	userId: string;
	title: string;
	content: string;
	status: string;
	createdAt: Date;
	updatedAt: Date;
	user?: TopicUser | null;
}

const PAGE_SIZE = 20;

export default function RouteComponent() {
	return (
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={MessageSquareTextIcon}
				eyebrow="内容管理"
				title="话题管理"
				description="管理全站话题，支持审核、隐藏与删除操作"
			/>

			<TopicsTable />
		</div>
	);
}

function TopicsTable() {
	const queryClient = useQueryClient();
	const [statusFilter, setStatusFilter] = useState("");
	const [offset, setOffset] = useState(0);

	const { data, isLoading, error } = useQuery({
		queryKey: [
			"admin-all-topics",
			{ status: statusFilter, offset, limit: PAGE_SIZE },
		],
		queryFn: async () => {
			const res = await adminGetAllTopics({
				data: {
					page: Math.floor(offset / PAGE_SIZE) + 1,
					limit: PAGE_SIZE,
					status: statusFilter || undefined,
				},
			});
			return res as unknown as {
				topics: AdminTopic[];
				total: number;
				totalPages: number;
			};
		},
	});

	useEffect(() => {
		if (error) {
			toast.error(error instanceof Error ? error.message : "获取话题列表出错");
		}
	}, [error]);

	const topics = data?.topics ?? [];
	const total = data?.total ?? 0;

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["admin-all-topics"] });
	};

	const statusLabel: Record<string, { label: string; tone: StatusTone }> = {
		published: { label: "已发布", tone: "success" },
		hidden: { label: "已隐藏", tone: "warning" },
		deleted: { label: "已删除", tone: "destructive" },
	};

	return (
		<TableCard>
			<TableToolbar>
				<Select
					value={statusFilter}
					onValueChange={(v) => {
						setStatusFilter(v != null && v === "__all__" ? "" : (v ?? ""));
						setOffset(0);
					}}
				>
					<SelectTrigger className="w-28">
						<SelectValue placeholder="状态" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__all__">全部状态</SelectItem>
						<SelectItem value="published">已发布</SelectItem>
						<SelectItem value="hidden">已隐藏</SelectItem>
						<SelectItem value="deleted">已删除</SelectItem>
					</SelectContent>
				</Select>
			</TableToolbar>

			<TableScroll>
				<Table minWidth="min-w-[820px]">
					<THead>
						<Tr>
							<Th>ID</Th>
							<Th>标题</Th>
							<Th>作者</Th>
							<Th>状态</Th>
							<Th>创建时间</Th>
							<Th align="right">操作</Th>
						</Tr>
					</THead>
					{isLoading ? (
						<TableSkeleton columns={6} />
					) : topics.length === 0 ? (
						<tbody>
							<TableEmpty
								colSpan={6}
								icon={MessageSquareTextIcon}
								title="暂无话题数据"
								description="调整筛选条件后再试"
							/>
						</tbody>
					) : (
						<TBody>
							{topics.map((topic) => {
								const sl = statusLabel[topic.status] ?? {
									label: topic.status,
									tone: "neutral" as const,
								};
								return (
									<Tr key={topic.id}>
										<Td className="text-xs text-muted-foreground">
											#{topic.id}
										</Td>
										<Td className="max-w-xs">
											<Link
												to={"/topics/$topicId"}
												params={{ topicId: String(topic.id) }}
												target="_blank"
												className="inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
											>
												{topic.title}
												<ExternalLinkIcon className="shrink-0 size-3" />
											</Link>
										</Td>
										<Td>
											<span className="text-sm text-muted-foreground">
												{topic.user?.name || "未知"}
											</span>
										</Td>
										<Td>
											<StatusPill tone={sl.tone}>{sl.label}</StatusPill>
										</Td>
										<Td className="text-xs text-muted-foreground whitespace-nowrap">
											{new Date(topic.createdAt).toLocaleDateString("zh-CN")}
										</Td>
										<Td align="right">
											<div className="flex gap-1.5 justify-end items-center">
												{topic.status !== "published" && (
													<PublishTopicButton topic={topic} onDone={refresh} />
												)}
												{topic.status === "published" && (
													<HideTopicButton topic={topic} onDone={refresh} />
												)}
												{topic.status === "hidden" && (
													<RestoreTopicButton topic={topic} onDone={refresh} />
												)}
												<DeleteTopicDialog topic={topic} onDone={refresh} />
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

function PublishTopicButton({
	topic,
	onDone,
}: {
	topic: AdminTopic;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handlePublish = async () => {
		setLoading(true);
		try {
			const res = await adminUpdateTopicStatus({
				data: { id: topic.id, status: "published" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("话题已发布");
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
				<span className="text-xs font-medium text-success">发布</span>
			)}
		</Button>
	);
}

function HideTopicButton({
	topic,
	onDone,
}: {
	topic: AdminTopic;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleHide = async () => {
		setLoading(true);
		try {
			const res = await adminUpdateTopicStatus({
				data: { id: topic.id, status: "hidden" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("话题已隐藏");
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

function RestoreTopicButton({
	topic,
	onDone,
}: {
	topic: AdminTopic;
	onDone: () => void;
}) {
	const [loading, setLoading] = useState(false);

	const handleRestore = async () => {
		setLoading(true);
		try {
			const res = await adminUpdateTopicStatus({
				data: { id: topic.id, status: "published" },
			});
			if (!res) {
				toast.error("操作失败");
				return;
			}
			toast.success("话题已恢复");
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
				<span className="text-xs font-medium text-success">恢复</span>
			)}
		</Button>
	);
}

function DeleteTopicDialog({
	topic,
	onDone,
}: {
	topic: AdminTopic;
	onDone: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const handleDelete = async () => {
		setSubmitting(true);
		try {
			const res = await adminDeleteTopic({ data: { id: topic.id } });
			if (!res) {
				toast.error("删除话题失败");
				return;
			}
			toast.success("话题已删除");
			setOpen(false);
			onDone();
		} catch {
			toast.error("删除话题出错");
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
					<DialogTitle>删除话题</DialogTitle>
					<DialogDescription>
						此操作将软删除该话题，将其状态标记为"已删除"。
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">确定要删除此话题吗？</p>
					<blockquote className="pl-3 text-sm italic text-muted-foreground border-l-2">
						{topic.title}
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
