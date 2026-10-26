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
import { SearchField } from "@web/components/shared/search-field";
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
import { Input } from "@web/components/ui/input";
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
	adminCreateCollection,
	adminDeleteCollection,
	adminGetCollections,
	adminSearchGames,
	adminSearchProducers,
	adminUpdateCollection,
	adminUpdateCollectionEntries,
} from "@web/server/admin/collections";
import {
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
		<div className="flex flex-col gap-6">
			<AdminPageHeader
				icon={Package}
				eyebrow="内容管理"
				title="合集管理"
				description="管理全站合集，支持创建、编辑与删除操作"
				actions={<CreateCollectionDialog onDone={() => {}} />}
			/>

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

	const refresh = () => {
		queryClient.invalidateQueries({ queryKey: ["admin-all-collections"] });
	};

	const statusLabel: Record<string, { label: string; tone: StatusTone }> = {
		published: { label: "已发布", tone: "success" },
		hidden: { label: "已隐藏", tone: "warning" },
	};

	const typeLabel: Record<string, { label: string }> = {
		manual: { label: "手动选择" },
		producer: { label: "会社绑定" },
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
					</SelectContent>
				</Select>
			</TableToolbar>

			<TableScroll>
				<Table minWidth="min-w-[820px]">
					<THead>
						<Tr>
							<Th>ID</Th>
							<Th>标题</Th>
							<Th>类型</Th>
							<Th>状态</Th>
							<Th>创建时间</Th>
							<Th align="right">操作</Th>
						</Tr>
					</THead>
					{isLoading ? (
						<TableSkeleton columns={6} />
					) : collections.length === 0 ? (
						<tbody>
							<TableEmpty
								colSpan={6}
								icon={Package}
								title="暂无合集数据"
								description="调整筛选条件，或新建一个合集"
							/>
						</tbody>
					) : (
						<TBody>
							{collections.map((collection) => {
								const sl = statusLabel[collection.status] ?? {
									label: collection.status,
									tone: "neutral" as const,
								};
								const tl = typeLabel[collection.type] ?? {
									label: collection.type,
								};
								return (
									<Tr key={collection.id}>
										<Td className="text-xs text-muted-foreground">
											#{collection.id}
										</Td>
										<Td className="max-w-xs">
											<Link
												to={"/collections/$id"}
												params={{ id: String(collection.id) }}
												target="_blank"
												className="inline-flex gap-1 items-center text-sm font-medium text-primary rounded transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
											>
												{collection.title}
												<ExternalLinkIcon className="shrink-0 size-3" />
											</Link>
										</Td>
										<Td>
											<Badge variant="secondary">{tl.label}</Badge>
										</Td>
										<Td>
											<StatusPill tone={sl.tone}>{sl.label}</StatusPill>
										</Td>
										<Td className="text-xs text-muted-foreground whitespace-nowrap">
											{new Date(collection.createdAt).toLocaleDateString(
												"zh-CN",
											)}
										</Td>
										<Td align="right">
											<div className="flex gap-1.5 justify-end items-center">
												<EditCollectionDialog
													collection={collection}
													onDone={refresh}
												/>
												<DeleteCollectionDialog
													collection={collection}
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

interface ProducerSearchProps {
	selectedIds: string[];
	onToggle: (pid: string) => void;
}

function ProducerSearch({ selectedIds, onToggle }: ProducerSearchProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Producer[]>([]);
	const [searching, setSearching] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
			<Label>绑定会社</Label>
			{selectedIds.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-2">
					{selectedIds.map((pid) => (
						<Badge key={pid} variant="secondary" className="gap-1">
							{pid}
							<button
								type="button"
								aria-label={`移除会社 ${pid}`}
								onClick={() => onToggle(pid)}
								className="ml-1 rounded transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			<SearchField
				value={query}
				onChange={handleInput}
				placeholder="搜索会社名称或输入 ID（如 p123）"
				ariaLabel="搜索会社"
			/>
			{(results.length > 0 || searching) && (
				<div className="overflow-y-auto max-h-40 rounded-xl divide-y ring-1 ring-border/60">
					{searching && results.length === 0 && (
						<div className="flex justify-center items-center py-4">
							<Loader2Icon className="size-4 text-muted-foreground animate-spin" />
						</div>
					)}
					{results.map((p) => (
						<label
							key={p.id}
							className="flex gap-2 items-center px-3 py-2 transition-colors cursor-pointer hover:bg-muted/40"
						>
							<input
								type="checkbox"
								checked={selectedIds.includes(p.id)}
								onChange={() => onToggle(p.id)}
								className="size-4"
							/>
							<div className="flex-1 min-w-0">
								<span className="block text-sm truncate">{p.name}</span>
								{p.latin && (
									<span className="block text-xs text-muted-foreground truncate">
										{p.latin}
									</span>
								)}
							</div>
							<span className="shrink-0 font-mono text-xs text-muted-foreground">
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
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const doSearch = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		setSearching(true);
		try {
			const res = await adminSearchGames({ data: { q: q.trim(), limit: 20 } });
			const games = (res ?? []) as unknown as GameInfo[];
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
			<Label>游戏条目（VID）</Label>
			{selectedVids.length > 0 && (
				<div className="flex flex-wrap gap-1 mb-2">
					{selectedVids.map((vid) => (
						<Badge key={vid} variant="secondary" className="gap-1">
							{vid}
							<button
								type="button"
								aria-label={`移除游戏 ${vid}`}
								onClick={() => onRemove(vid)}
								className="ml-1 rounded transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
				</div>
			)}
			<SearchField
				value={query}
				onChange={handleInput}
				placeholder="搜索游戏名称或输入 VID（如 v12345）"
				ariaLabel="搜索游戏"
			/>
			{(results.length > 0 || searching) && (
				<div className="overflow-y-auto max-h-40 rounded-xl divide-y ring-1 ring-border/60">
					{searching && results.length === 0 && (
						<div className="flex justify-center items-center py-4">
							<Loader2Icon className="size-4 text-muted-foreground animate-spin" />
						</div>
					)}
					{results.map((g) => (
						<button
							key={g.id}
							type="button"
							className="flex gap-2 items-center px-3 py-2 w-full text-left transition-colors hover:bg-muted/40 disabled:opacity-50"
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
								<span className="block text-sm truncate">
									{g.title || g.alias || g.id}
								</span>
							</div>
							<span className="shrink-0 font-mono text-xs text-muted-foreground">
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
				<Plus className="mr-1 size-4" />
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
							<Label>合集名称</Label>
							<Input
								value={form.title}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, title: e.target.value }))
								}
								placeholder="输入合集名称"
							/>
						</div>

						<div className="space-y-2">
							<Label>简介</Label>
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
							<Label>类型</Label>
							<Select
								value={form.type}
								onValueChange={(v) =>
									setForm((prev) => ({ ...prev, type: v ?? prev.type }))
								}
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
							<Label>状态</Label>
							<Select
								value={form.status}
								onValueChange={(v) =>
									setForm((prev) => ({ ...prev, status: v ?? prev.status }))
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
							{submitting && <Loader2Icon className="size-4 animate-spin" />}
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
							<Label>合集名称</Label>
							<Input
								value={form.title}
								onChange={(e) =>
									setForm((prev) => ({ ...prev, title: e.target.value }))
								}
								placeholder="输入合集名称"
							/>
						</div>

						<div className="space-y-2">
							<Label>简介</Label>
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
							<Label>类型</Label>
							<Select
								value={form.type}
								onValueChange={(v) =>
									setForm((prev) => ({ ...prev, type: v ?? prev.type }))
								}
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
							<Label>状态</Label>
							<Select
								value={form.status}
								onValueChange={(v) =>
									setForm((prev) => ({ ...prev, status: v ?? prev.status }))
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
							{submitting && <Loader2Icon className="size-4 animate-spin" />}
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
						<blockquote className="pl-3 text-sm italic text-muted-foreground border-l-2">
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
							{submitting && <Loader2Icon className="size-4 animate-spin" />}
							确认删除
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
