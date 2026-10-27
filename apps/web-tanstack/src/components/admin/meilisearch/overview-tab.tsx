import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusPill } from "@web/components/admin/admin-table";
import {
	type AdminColumn,
	AdminDataTable,
	type AdminSort,
	DataTableToolbar,
	RowActionsMenu,
} from "@web/components/admin/data-table";
import { Button } from "@web/components/ui/button";
import { Card, CardContent } from "@web/components/ui/card";
import { adminKeys } from "@web/lib/admin/query-keys";
import { getMeiliStats } from "@web/server/admin/meilisearch";
import {
	ClockIcon,
	DatabaseIcon,
	FileTextIcon,
	HardDriveIcon,
	Loader2Icon,
	RefreshCwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	ErrorDisplay,
	extractError,
	formatBytes,
	formatNumber,
	formatTime,
	ignoreAbort,
	indexIcon,
	indexTypeFromName,
	indexTypeLabels,
	MiniBar,
	relativeTime,
	StatCard,
	StatSkeleton,
	useRebuildIndex,
} from "./shared";
import type { IndexType, MeiliStats } from "./types";

// ─── 索引行 ───────────────────────────────────────────────────

type IndexRow = {
	name: string;
	documents: number;
	fields: number;
	isIndexing: boolean;
};

function sortIndexRows(rows: IndexRow[], sort: AdminSort): IndexRow[] {
	if (!sort) {
		return [...rows].sort((left, right) => right.documents - left.documents);
	}
	const direction = sort.desc ? -1 : 1;
	return [...rows].sort((left, right) => {
		if (sort.id === "fields") return (left.fields - right.fields) * direction;
		if (sort.id === "index")
			return left.name.localeCompare(right.name) * direction;
		return (left.documents - right.documents) * direction;
	});
}

/** 单索引的重建操作，收进 ⋯ 菜单（乐观更新在 useRebuildIndex 内完成）。 */
function IndexRebuildAction({ type, name }: { type: IndexType; name: string }) {
	const rebuild = useRebuildIndex(type, {
		mutationKey: ["admin", "meili", "rebuild", type],
		indexName: name,
	});
	return (
		<RowActionsMenu
			actions={[
				{
					label: `重建${indexTypeLabels[type]}索引`,
					icon: RefreshCwIcon,
					onSelect: () => rebuild.mutate(),
					pending: rebuild.isPending,
				},
			]}
		/>
	);
}

function IndexRowActions({ name }: { name: string }) {
	const type = indexTypeFromName(name);
	if (!type) return null;
	return <IndexRebuildAction type={type} name={name} />;
}

// ─── Tab ─────────────────────────────────────────────────────

export function OverviewTab() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<AdminSort>(null);

	const {
		data: raw,
		isLoading,
		isFetching,
		error,
		refetch,
	} = useQuery({
		queryKey: adminKeys.meiliStats(),
		queryFn: ignoreAbort(getMeiliStats),
		staleTime: 30_000,
	});

	const stats = raw as MeiliStats | undefined;

	const allRows = useMemo<IndexRow[]>(() => {
		const indexes = stats?.indexes ?? {};
		return Object.entries(indexes).map(([name, info]) => ({
			name,
			documents: info.numberOfDocuments ?? 0,
			fields: Object.keys(info.fieldDistribution ?? {}).length,
			isIndexing: !!info.isIndexing,
		}));
	}, [stats]);

	const rows = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		const filtered = keyword
			? allRows.filter((row) => row.name.toLowerCase().includes(keyword))
			: allRows;
		return sortIndexRows(filtered, sort);
	}, [allRows, search, sort]);

	const totalDocs = allRows.reduce((sum, row) => sum + row.documents, 0);
	const maxDocs = Math.max(1, ...allRows.map((row) => row.documents));
	const indexingCount = allRows.filter((row) => row.isIndexing).length;

	const columns: AdminColumn<IndexRow>[] = [
		{
			id: "index",
			header: "索引",
			sortable: true,
			mobile: "title",
			cell: (row) => {
				const Icon = indexIcon(row.name);
				return (
					<div className="flex gap-2.5 items-center min-w-0">
						<span className="flex justify-center items-center size-7 bg-muted/60 rounded-lg text-muted-foreground">
							<Icon className="size-3.5" />
						</span>
						<span className="font-medium truncate">{row.name}</span>
					</div>
				);
			},
		},
		{
			id: "documents",
			header: "文档数",
			align: "right",
			sortable: true,
			mobile: "meta",
			cell: (row) => (
				<span className="tabular-nums">{formatNumber(row.documents)}</span>
			),
		},
		{
			id: "share",
			header: "占比",
			align: "right",
			hideBelow: "sm",
			cell: (row) => (
				<div className="flex gap-2 justify-end items-center min-w-[120px]">
					<MiniBar
						className="w-20"
						value={(row.documents / maxDocs) * 100}
						tone={row.isIndexing ? "warning" : "primary"}
					/>
					<span className="w-10 text-xs tabular-nums text-muted-foreground text-right">
						{totalDocs > 0
							? `${Math.round((row.documents / totalDocs) * 100)}%`
							: "-"}
					</span>
				</div>
			),
		},
		{
			id: "fields",
			header: "字段数",
			align: "right",
			sortable: true,
			hideBelow: "md",
			cell: (row) => (
				<span className="tabular-nums">{formatNumber(row.fields)}</span>
			),
		},
		{
			id: "status",
			header: "状态",
			align: "right",
			mobile: "meta",
			cell: (row) => (
				<StatusPill
					tone={row.isIndexing ? "info" : "neutral"}
					icon={row.isIndexing ? Loader2Icon : undefined}
					spin={row.isIndexing}
				>
					{row.isIndexing ? "索引中" : "就绪"}
				</StatusPill>
			),
		},
	];

	if (error) {
		return (
			<Card>
				<CardContent className="pt-2">
					<ErrorDisplay
						message={extractError(error)}
						onRetry={() => refetch()}
					/>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{/* KPI 概览 */}
			{isLoading && !stats ? (
				<StatSkeleton />
			) : (
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<StatCard
						icon={HardDriveIcon}
						label="数据库大小"
						value={formatBytes(stats?.databaseSize)}
					/>
					<StatCard
						icon={FileTextIcon}
						label="总文档数"
						value={formatNumber(totalDocs)}
						description={
							indexingCount > 0
								? `${indexingCount} 个索引进行中`
								: "全部索引就绪"
						}
					/>
					<StatCard
						icon={DatabaseIcon}
						label="索引数量"
						value={allRows.length}
						description={
							allRows.length > 0
								? `${allRows.filter((row) => row.documents > 0).length} 个有数据`
								: "尚未创建索引"
						}
					/>
					<StatCard
						icon={ClockIcon}
						label="最后更新"
						value={relativeTime(stats?.lastUpdate) || "-"}
						description={
							stats?.lastUpdate ? formatTime(stats.lastUpdate) : undefined
						}
					/>
				</div>
			)}

			{/* 索引详情 */}
			<AdminDataTable<IndexRow>
				columns={columns}
				rows={rows}
				getRowId={(row) => row.name}
				isLoading={isLoading}
				isFetching={isFetching}
				skeletonRows={4}
				sort={sort}
				onSortChange={setSort}
				minWidth="min-w-[640px]"
				empty={{
					icon: DatabaseIcon,
					title: search ? "没有匹配的索引" : "暂无索引数据",
					description: search
						? `没有名称包含「${search}」的索引`
						: "Meilisearch 实例中尚未创建任何索引",
					action: search ? (
						<Button variant="outline" size="sm" onClick={() => setSearch("")}>
							清除搜索
						</Button>
					) : undefined,
				}}
				toolbar={
					<DataTableToolbar
						search={{
							value: search,
							onChange: setSearch,
							placeholder: "搜索索引名…",
							ariaLabel: "搜索索引名",
						}}
						isFiltered={search.length > 0}
						onReset={() => setSearch("")}
						actions={
							<Button
								variant="outline"
								size="sm"
								className="h-8 rounded-xl font-normal"
								onClick={() => {
									void queryClient.invalidateQueries({
										queryKey: adminKeys.meiliStats(),
									});
								}}
								disabled={isFetching}
							>
								<RefreshCwIcon
									className={isFetching ? "size-3.5 animate-spin" : "size-3.5"}
								/>
								刷新
							</Button>
						}
					/>
				}
				rowActions={(row) => <IndexRowActions name={row.name} />}
				actionsHeader="索引操作"
			/>

			<p className="px-1 text-xs text-muted-foreground">
				文档数来自 Meilisearch
				统计；重建会清空索引并从数据库重新导入，通常需要数分钟，可在「索引管理」中查看进度。
			</p>
		</div>
	);
}
