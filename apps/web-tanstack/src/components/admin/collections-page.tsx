import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { Textarea } from "@web/components/ui/textarea";
import {
	adminCreateCollection,
	adminDeleteCollection,
	adminGetCollections,
	adminSearchGames,
	adminSearchProducers,
	adminUpdateCollection,
	adminUpdateCollectionEntries,
} from "@web/server/admin/collections";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ExternalLinkIcon,
	Loader2Icon,
	Package,
	Pencil,
	Plus,
	Trash2Icon,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface AdminCollection {
	id: number;
	title: string;
	description?: string | null;
	type: string;
	producerIds?: string[] | null;
	status: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	entries?: Array<{ id: number; vid: string; sortOrder: number }>;
}

interface Producer {
	id: string;
	name: string;
	latin: string;
}

interface CollectionFormData {
	title: string;
	description: string;
	type: string;
	producerIds: string[];
	status: string;
	entries: { vid: string; sortOrder: number }[];
}

const PAGE_SIZE = 20;

export default function CollectionsPage() {
	return (
		<div className="container mx-auto py-6 space-y-6 max-w-4xl">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">合集管理</h1>
					<p className="text-muted-foreground mt-1">
						管理全站合集，支持创建、编辑与删除操作
					</p>
				</div>
				<CreateCollectionDialog onDone={() => {}} />
			</div>

			<CollectionsTable />
		</div>
	);
}

function CollectionsTable() {
	const queryClient = useQueryClient();
	const [statusFilter, setStatusFilter] = useState("");
	const [offset, setOffset] = useState(0);

	const { data, isLoading, error } = useQuery({
		queryKey: [
			"admin-all-collections",
			{ status: statusFilter, offset, limit: PAGE_SIZE },
		],
		queryFn: async () => {
			const res = await adminGetCollections({
				data: {
					page: Math.floor(offset / PAGE_SIZE) + 1,
					limit: PAGE_SIZE,
					status: statusFilter,
				},
			});
			return res as unknown as {
				items: AdminCollection[];
				total: number;
			};
		},
	});

	useEffect(() => {
		if (error) {
			toast.error(error instanceof Error ? error.message : "获取合集列表出错");
		}
	}, [error]);

	const collections = data?.items ?? [];
	const total = Number(data?.total ?? 0);

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
		queryClient.invalidateQueries({ queryKey: ["admin-all-collections"] });
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
	};

	const typeLabel: Record<string, { label: string }> = {
		manual: { label: "手动选择" },
		producer: { label: "会社绑定" },
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
						</SelectContent>
					</Select>
				</div>
			</CardHeader>

			<CardContent className="p-0">
				{isLoading ? (
					<div className="flex items-center justify-center py-16">
						<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : collections.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
						<Package className="size-10 mb-2" />
						<p className="text-sm">暂无合集数据</p>
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
										类型
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
								{collections.map((collection) => {
									const sl = statusLabel[collection.status] ?? {
										label: collection.status,
										variant: "secondary" as const,
									};
									const tl = typeLabel[collection.type] ?? {
										label: collection.type,
									};
									return (
										<tr
											key={collection.id}
											className="border-b last:border-0 hover:bg-muted/30 transition-colors"
										>
											<td className="px-4 py-3 text-xs text-muted-foreground">
												#{collection.id}
											</td>
											<td className="px-4 py-3 max-w-xs">
												<Link
													to={"/collections/$id"}
													params={{ id: String(collection.id) }}
													target="_blank"
													className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 underline hover:text-blue-700 hover:no-underline"
												>
													{collection.title}
													<ExternalLinkIcon className="size-3 shrink-0" />
												</Link>
											</td>
											<td className="px-4 py-3">
												<Badge variant="secondary">{tl.label}</Badge>
											</td>
											<td className="px-4 py-3">
												<Badge variant={sl.variant}>{sl.label}</Badge>
											</td>
											<td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
												{new Date(collection.createdAt).toLocaleDateString(
													"zh-CN",
												)}
											</td>
											<td className="px-4 py-3 text-right">
												<div className="flex items-center justify-end gap-1.5">
													<EditCollectionDialog
														collection={collection}
														onDone={refresh}
													/>
													<DeleteCollectionDialog
														collection={collection}
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
						共 {total} 个合集 · 第 {currentPage}/{totalPages} 页
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

interface ProducerSearchProps {
	selectedIds: string[];
	onToggle: (pid: string) => void;
}

function ProducerSearch({ selectedIds, onToggle }: ProducerSearchProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Producer[]>([]);
	const [searching, setSearching] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout>>();

	const doSearch = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		setSearching(true);
		try {
			const res = await adminSearchProducers({
				data: { q: q.trim(), limit: 20 },
			});
			setResults((res ?? []) as Producer[]);
		} catch {
			setResults([]);
		} finally {
			setSearching(false);
		}
	}, []);

	const handleInput = (value: string) => {
		setQuery(value);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => doSearch(value), 300);
	};

	return (
		<div className="space-y-2">
			<label className="text-sm font-medium">绑定会社</label>
			{selectedIds.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-2">
					{selectedIds.map((pid) => (
						<Badge key={pid} variant="secondary" className="gap-1">
							{pid}
							<button
								type="button"
								onClick={() => onToggle(pid)}
								className="ml-1 hover:text-destructive"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			<Input
				value={query}
				onChange={(e) => handleInput(e.target.value)}
				placeholder="搜索会社名称或输入 ID（如 p123）"
			/>
			{(results.length > 0 || searching) && (
				<div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
					{searching && results.length === 0 && (
						<div className="flex items-center justify-center py-4">
							<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
						</div>
					)}
					{results.map((p) => (
						<label
							key={p.id}
							className="flex items-center gap-2 cursor-pointer py-2 px-3 hover:bg-muted/50"
						>
							<input
								type="checkbox"
								checked={selectedIds.includes(p.id)}
								onChange={() => onToggle(p.id)}
								className="size-4"
							/>
							<div className="flex-1 min-w-0">
								<span className="text-sm block truncate">{p.name}</span>
								{p.latin && (
									<span className="text-xs text-muted-foreground block truncate">
										{p.latin}
									</span>
								)}
							</div>
							<span className="text-xs font-mono text-muted-foreground shrink-0">
								{p.id}
							</span>
						</label>
					))}
				</div>
			)}
		</div>
	);
}
interface GameInfo {
	id: string;
	alias: string | null;
	title: string | null;
	olang: string | null;
	titles_obj?: Array<{ lang: string; title: string; latin?: string }>;
}

function GameSearch({
	selectedVids,
	onAdd,
	onRemove,
}: {
	selectedVids: string[];
	onAdd: (vid: string) => void;
	onRemove: (vid: string) => void;
}) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GameInfo[]>([]);
	const [searching, setSearching] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout>>();

	const doSearch = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		setSearching(true);
		try {
			const res = await adminSearchGames({ data: { q: q.trim(), limit: 20 } });
			const games = (res ?? []) as GameInfo[];
			// Compute display title: zh-Hans > zh > olang > alias > id
			setResults(
				games.map((g) => {
					const titles = g.titles_obj ?? [];
					const titleObj =
						titles.find((t) => t.lang === "zh-Hans") ||
						titles.find((t) => t.lang === "zh") ||
						titles.find((t) => t.lang === g.olang);
					return { ...g, title: titleObj?.title ?? null };
				}),
			);
		} catch {
			setResults([]);
		} finally {
			setSearching(false);
		}
	}, []);

	const handleInput = (value: string) => {
		setQuery(value);
		clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => doSearch(value), 300);
	};

	return (
		<div className="space-y-2">
			<label className="text-sm font-medium">游戏条目（VID）</label>
			{selectedVids.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-2">
					{selectedVids.map((vid) => (
						<Badge key={vid} variant="secondary" className="gap-1">
							{vid}
							<button
								type="button"
								onClick={() => onRemove(vid)}
								className="ml-1 hover:text-destructive"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			<Input
				value={query}
				onChange={(e) => handleInput(e.target.value)}
				placeholder="搜索游戏名称或输入 VID（如 v12345）"
			/>
			{(results.length > 0 || searching) && (
				<div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
					{searching && results.length === 0 && (
						<div className="flex items-center justify-center py-4">
							<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
						</div>
					)}
					{results.map((g) => (
						<button
							key={g.id}
							type="button"
							className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-muted/50 disabled:opacity-50"
							disabled={selectedVids.includes(g.id)}
							onClick={() => {
								if (!selectedVids.includes(g.id)) {
									onAdd(g.id);
									setQuery("");
									setResults([]);
								}
							}}
						>
							<div className="flex-1 min-w-0">
								<span className="text-sm block truncate">
									{g.title || g.alias || g.id}
								</span>
							</div>
							<span className="text-xs font-mono text-muted-foreground shrink-0">
								{g.id}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function CreateCollectionDialog({ onDone }: { onDone: () => void }) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [form, setForm] = useState<CollectionFormData>({
		title: "",
		description: "",
		type: "manual",
		producerIds: [],
		status: "published",
		entries: [],
	});

	const handleSubmit = async () => {
		if (!form.title.trim()) {
			toast.error("请输入合集名称");
			return;
		}
		setSubmitting(true);
		try {
			const res = await adminCreateCollection({
				data: {
					title: form.title,
					description: form.description || undefined,
					type: form.type,
					producerIds: form.type === "producer" ? form.producerIds : undefined,
					status: form.status,
				},
			});
			if (!res?.success || !res.collection) {
				toast.error("创建合集失败");
				return;
			}

			// Insert entries for manual collections
			if (form.type === "manual" && form.entries.length > 0) {
				const entriesRes = await adminUpdateCollectionEntries({
					data: {
						id: res.collection.id,
						entries: form.entries.map((e, i) => ({
							vid: e.vid,
							sortOrder: i,
						})),
					},
				});
				if (!entriesRes?.success) {
					toast.error("创建条目失败");
					return;
				}
			}

			toast.success("合集已创建");
			setOpen(false);
			setForm({
				title: "",
				description: "",
				type: "manual",
				producerIds: [],
				status: "published",
				entries: [],
			});
			onDone();
		} catch {
			toast.error("创建合集出错");
		} finally {
			setSubmitting(false);
		}
	};

	const toggleProducer = (pid: string) => {
		setForm((prev) => ({
			...prev,
			producerIds: prev.producerIds.includes(pid)
				? prev.producerIds.filter((id) => id !== pid)
				: [...prev.producerIds, pid],
		}));
	};

	return (
		<>
			<Button onClick={() => setOpen(true)}>
				<Plus className="size-4 mr-1" />
				新建合集
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>新建合集</DialogTitle>
						<DialogDescription>
							创建一个新的游戏合集，可以是手动选择游戏或绑定会社
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">合集名称</label>
							<Input
								value={form.title}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, title: e.target.value }))
								}
								placeholder="输入合集名称"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">简介</label>
							<Textarea
								value={form.description}
								onChange={(e) =>
									setForm((prev) => ({
										...prev,
										description: e.target.value,
									}))
								}
								placeholder="输入合集简介（可选）"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">类型</label>
							<Select
								value={form.type}
								onValueChange={(v) => setForm((prev) => ({ ...prev, type: v }))}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="选择类型" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="manual">手动选择</SelectItem>
									<SelectItem value="producer">会社绑定</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{form.type === "producer" && (
							<ProducerSearch
								selectedIds={form.producerIds}
								onToggle={toggleProducer}
							/>
						)}

						{form.type === "manual" && (
							<GameSearch
								selectedVids={form.entries.map((e) => e.vid)}
								onAdd={(vid) =>
									setForm((prev) => ({
										...prev,
										entries: [
											...prev.entries,
											{ vid, sortOrder: prev.entries.length },
										],
									}))
								}
								onRemove={(vid) =>
									setForm((prev) => ({
										...prev,
										entries: prev.entries.filter((e) => e.vid !== vid),
									}))
								}
							/>
						)}

						<div className="space-y-2">
							<label className="text-sm font-medium">状态</label>
							<Select
								value={form.status}
								onValueChange={(v) =>
									setForm((prev) => ({ ...prev, status: v }))
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="选择状态" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="published">已发布</SelectItem>
									<SelectItem value="hidden">已隐藏</SelectItem>
								</SelectContent>
							</Select>
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
						<Button onClick={handleSubmit} disabled={submitting}>
							{submitting && (
								<Loader2Icon className="size-4 animate-spin mr-1" />
							)}
							创建
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function EditCollectionDialog({
	collection,
	onDone,
}: {
	collection: AdminCollection;
	onDone: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [form, setForm] = useState<CollectionFormData>({
		title: collection.title,
		description: collection.description ?? "",
		type: collection.type,
		producerIds: collection.producerIds ?? [],
		status: collection.status,
		entries: collection.entries ?? [],
	});
	const [vidInput, setVidInput] = useState("");

	useEffect(() => {
		if (!open) return;
		setForm({
			title: collection.title,
			description: collection.description ?? "",
			type: collection.type,
			producerIds: collection.producerIds ?? [],
			status: collection.status,
			entries: collection.entries ?? [],
		});
	}, [open, collection.id]);

	const handleSubmit = async () => {
		if (!form.title.trim()) {
			return;
		}
		setSubmitting(true);
		try {
			const res = await adminUpdateCollection({
				data: {
					id: collection.id,
					title: form.title,
					description: form.description || undefined,
					type: form.type,
					producerIds: form.type === "producer" ? form.producerIds : undefined,
					status: form.status,
				},
			});
			if (!res?.success) {
				toast.error("更新合集失败");
				return;
			}

			if (form.type === "manual" && form.entries.length > 0) {
				const entriesRes = await adminUpdateCollectionEntries({
					data: {
						id: collection.id,
						entries: form.entries.map((e, i) => ({
							vid: e.vid,
							sortOrder: i,
						})),
					},
				});
				if (!entriesRes?.success) {
					toast.error("更新条目失败");
					return;
				}
			}

			toast.success("合集已更新");
			setOpen(false);
			onDone();
		} catch {
			toast.error("更新合集出错");
		} finally {
			setSubmitting(false);
		}
	};

	const toggleProducer = (pid: string) => {
		setForm((prev) => ({
			...prev,
			producerIds: prev.producerIds.includes(pid)
				? prev.producerIds.filter((id) => id !== pid)
				: [...prev.producerIds, pid],
		}));
	};

	return (
		<>
			<Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
				<Pencil className="size-4" />
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>编辑合集</DialogTitle>
						<DialogDescription>修改合集的信息和条目</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">合集名称</label>
							<Input
								value={form.title}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, title: e.target.value }))
								}
								placeholder="输入合集名称"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">简介</label>
							<Textarea
								value={form.description}
								onChange={(e) =>
									setForm((prev) => ({
										...prev,
										description: e.target.value,
									}))
								}
								placeholder="输入合集简介（可选）"
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">类型</label>
							<Select
								value={form.type}
								onValueChange={(v) => setForm((prev) => ({ ...prev, type: v }))}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="选择类型" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="manual">手动选择</SelectItem>
									<SelectItem value="producer">会社绑定</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{form.type === "producer" && (
							<ProducerSearch
								selectedIds={form.producerIds}
								onToggle={toggleProducer}
							/>
						)}

						{form.type === "manual" && (
							<GameSearch
								selectedVids={form.entries.map((e) => e.vid)}
								onAdd={(vid) =>
									setForm((prev) => ({
										...prev,
										entries: [
											...prev.entries,
											{ vid, sortOrder: prev.entries.length },
										],
									}))
								}
								onRemove={(vid) =>
									setForm((prev) => ({
										...prev,
										entries: prev.entries.filter((e) => e.vid !== vid),
									}))
								}
							/>
						)}

						<div className="space-y-2">
							<label className="text-sm font-medium">状态</label>
							<Select
								value={form.status}
								onValueChange={(v) =>
									setForm((prev) => ({ ...prev, status: v }))
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="选择状态" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="published">已发布</SelectItem>
									<SelectItem value="hidden">已隐藏</SelectItem>
								</SelectContent>
							</Select>
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
						<Button onClick={handleSubmit} disabled={submitting}>
							{submitting && (
								<Loader2Icon className="size-4 animate-spin mr-1" />
							)}
							保存
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function DeleteCollectionDialog({
	collection,
	onDone,
}: {
	collection: AdminCollection;
	onDone: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const handleDelete = async () => {
		setSubmitting(true);
		try {
			const res = await adminDeleteCollection({
				data: { id: collection.id },
			});
			if (!res?.success) {
				toast.error("删除合集失败");
				return;
			}
			toast.success("合集已删除");
			setOpen(false);
			onDone();
		} catch {
			toast.error("删除合集出错");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
				<Trash2Icon className="size-4 text-destructive" />
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>删除合集</DialogTitle>
						<DialogDescription>
							此操作将永久删除该合集及其所有条目，不可恢复。
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							确定要删除此合集吗？
						</p>
						<blockquote className="text-sm border-l-2 pl-3 text-muted-foreground italic">
							{collection.title}
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
							{submitting && (
								<Loader2Icon className="size-4 animate-spin mr-1" />
							)}
							确认删除
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
