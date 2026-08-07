import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AdminPageHeader } from "@web/components/admin/admin-page-header";
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
	ChevronLeftIcon,
	ChevronRightIcon,
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

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["admin-all-topics"] });
	};

	const statusLabel: Record<
		string,
		{
			label: string;
			variant: "default" | "secondary" | "destructive" | "outline";
		}
	> = {
		published: { label: "已发布", variant: "outline" as const },
		hidden: { label: "已隐藏", variant: "secondary" as const },
		deleted: { label: "已删除", variant: "destructive" as const },
	};

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center gap-3">
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
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{isLoading ? (
					<div className="flex items-center justify-center py-16">
						<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : topics.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
						<MessageSquareTextIcon className="size-10 mb-2" />
						<p className="text-sm">暂无话题数据</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										ID
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										标题
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										作者
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										状态
									</th>
									<th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
										创建时间
									</th>
									<th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
										操作
									</th>
								</tr>
							</thead>
							<tbody>
								{topics.map((topic) => {
									const sl = statusLabel[topic.status] ?? {
										label: topic.status,
										variant: "secondary" as const,
									};
									return (
										<tr
											key={topic.id}
											className="border-b last:border-0 hover:bg-muted/30 transition-colors"
										>
											<td className="px-4 py-3 text-xs text-muted-foreground">
												#{topic.id}
											</td>
											<td className="px-4 py-3 max-w-xs">
												<Link
													to={"/topics/$topicId"}
													params={{ topicId: String(topic.id) }}
													target="_blank"
													className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 underline hover:text-blue-700 hover:no-underline"
												>
													{topic.title}
													<ExternalLinkIcon className="size-3 shrink-0" />
												</Link>
											</td>
											<td className="px-4 py-3">
												<span className="text-sm text-muted-foreground">
													{topic.user?.name || "未知"}
												</span>
											</td>
											<td className="px-4 py-3">
												<Badge variant={sl.variant}>{sl.label}</Badge>
											</td>
											<td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
												{new Date(topic.createdAt).toLocaleDateString("zh-CN")}
											</td>
											<td className="px-4 py-3 text-right">
												<div className="flex items-center justify-end gap-1.5">
													{topic.status !== "published" && (
														<PublishTopicButton
															topic={topic}
															onDone={refresh}
														/>
													)}
													{topic.status === "published" && (
														<HideTopicButton topic={topic} onDone={refresh} />
													)}
													{topic.status === "hidden" && (
														<RestoreTopicButton
															topic={topic}
															onDone={refresh}
														/>
													)}
													<DeleteTopicDialog topic={topic} onDone={refresh} />
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
						共 {total} 个话题 · 第 {currentPage}/{totalPages} 页
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
				<span className="text-xs text-green-600">发布</span>
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
				<span className="text-xs text-green-600">恢复</span>
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
					<blockquote className="text-sm border-l-2 pl-3 text-muted-foreground italic">
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
						{submitting && <Loader2Icon className="size-4 animate-spin mr-1" />}
						确认删除
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
