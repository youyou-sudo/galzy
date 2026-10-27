import { useQuery } from "@tanstack/react-query";
import { StatusPill } from "@web/components/admin/admin-table";
import {
	type AdminColumn,
	AdminDataTable,
	type AdminFilter,
	DataTablePagination,
	DataTableToolbar,
} from "@web/components/admin/data-table";
import { Button } from "@web/components/ui/button";
import { Card, CardContent } from "@web/components/ui/card";
import { useAdminTableState } from "@web/hooks/use-admin-table-state";
import { adminKeys } from "@web/lib/admin/query-keys";
import {
	getPropertyList,
	getSearchableAttributes,
} from "@web/server/admin/meilisearch";
import { CopyIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	ErrorDisplay,
	extractError,
	ignoreAbort,
	indexTypeLabels,
} from "./shared";
import type { IndexType } from "./types";

type PropertyRow = { name: string; searchable: boolean };

async function copyText(text: string, message: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(message);
	} catch {
		toast.error("复制失败");
	}
}

export function PropertiesTab({ indexType }: { indexType: IndexType }) {
	const [search, setSearch] = useState("");
	const [searchableFilter, setSearchableFilter] = useState("");
	const table = useAdminTableState({
		storageKey: "meili-properties",
		defaultPageSize: 20,
	});

	const { data, isLoading, isFetching, error, refetch } = useQuery({
		queryKey: adminKeys.meiliProperties(indexType),
		queryFn: ignoreAbort(() => getPropertyList({ data: { indexType } })),
		staleTime: 5 * 60 * 1000,
	});

	const { data: searchableData } = useQuery({
		queryKey: adminKeys.meiliSearchable(indexType),
		queryFn: ignoreAbort(() =>
			getSearchableAttributes({ data: { indexType } }),
		),
		staleTime: 5 * 60 * 1000,
	});

	const searchableSet = useMemo(() => {
		const list = Array.isArray(searchableData)
			? searchableData.filter(
					(field): field is string => typeof field === "string",
				)
			: [];
		return new Set(list);
	}, [searchableData]);

	const allRows = useMemo<PropertyRow[]>(() => {
		const list = Array.isArray(data)
			? data.filter(
					(property): property is string => typeof property === "string",
				)
			: [];
		return list.map((name) => ({ name, searchable: searchableSet.has(name) }));
	}, [data, searchableSet]);

	const filteredRows = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		return allRows.filter((row) => {
			if (keyword && !row.name.toLowerCase().includes(keyword)) return false;
			if (searchableFilter === "yes" && !row.searchable) return false;
			if (searchableFilter === "no" && row.searchable) return false;
			return true;
		});
	}, [allRows, search, searchableFilter]);

	const pageCount = Math.max(
		1,
		Math.ceil(filteredRows.length / table.pageSize),
	);
	const safePage = Math.min(table.page, pageCount);
	const pagedRows = filteredRows.slice(
		(safePage - 1) * table.pageSize,
		safePage * table.pageSize,
	);

	const filters: AdminFilter[] = [
		{
			id: "searchable",
			label: "可搜索",
			value: searchableFilter,
			onChange: (value) => {
				setSearchableFilter(value);
				table.resetToFirstPage();
			},
			options: [
				{ value: "yes", label: "仅搜索字段" },
				{ value: "no", label: "非搜索字段" },
			],
		},
	];

	const columns: AdminColumn<PropertyRow>[] = [
		{
			id: "name",
			header: "属性名",
			mobile: "title",
			cell: (row) => (
				<span className="font-mono text-xs break-all">{row.name}</span>
			),
		},
		{
			id: "searchable",
			header: "搜索字段",
			align: "right",
			mobile: "meta",
			cell: (row) => (
				<StatusPill tone={row.searchable ? "success" : "neutral"}>
					{row.searchable ? "可搜索" : "否"}
				</StatusPill>
			),
		},
	];

	const isFiltered = search.length > 0 || searchableFilter.length > 0;

	const resetFilters = () => {
		setSearch("");
		setSearchableFilter("");
		table.resetToFirstPage();
	};

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
		<AdminDataTable<PropertyRow>
			columns={columns}
			rows={pagedRows}
			getRowId={(row) => row.name}
			isLoading={isLoading}
			isFetching={isFetching}
			skeletonRows={6}
			density={table.density}
			minWidth="min-w-[480px]"
			empty={{
				icon: search || searchableFilter ? SearchIcon : RefreshCwIcon,
				title: isFiltered ? "没有匹配的属性" : "索引中暂无属性数据",
				description: isFiltered
					? "换一个关键词，或重置筛选后再试"
					: `${indexTypeLabels[indexType]}索引尚未导入文档，导入后即可看到字段列表`,
				action: isFiltered ? (
					<Button variant="outline" size="sm" onClick={resetFilters}>
						重置筛选
					</Button>
				) : (
					<Button variant="outline" size="sm" onClick={() => refetch()}>
						刷新
					</Button>
				),
			}}
			toolbar={
				<DataTableToolbar
					search={{
						value: search,
						onChange: (value) => {
							setSearch(value);
							table.resetToFirstPage();
						},
						placeholder: "按属性名过滤…",
						ariaLabel: "按属性名过滤",
					}}
					filters={filters}
					isFiltered={isFiltered}
					onReset={resetFilters}
					density={table.density}
					onDensityChange={table.setDensity}
					leading={
						<span className="text-xs text-muted-foreground">
							目标索引：
							<span className="font-medium text-foreground">
								{indexTypeLabels[indexType]}
							</span>
						</span>
					}
					actions={
						<>
							<Button
								variant="outline"
								size="sm"
								className="h-8 rounded-xl font-normal"
								onClick={() =>
									copyText(
										allRows.map((row) => row.name).join("\n"),
										`已复制 ${allRows.length} 个属性名`,
									)
								}
								disabled={allRows.length === 0}
							>
								<CopyIcon className="size-3.5" />
								复制全部
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="刷新属性列表"
								onClick={() => refetch()}
								disabled={isFetching}
							>
								<RefreshCwIcon
									className={isFetching ? "size-4 animate-spin" : "size-4"}
								/>
							</Button>
						</>
					}
				/>
			}
			footer={
				<DataTablePagination
					page={safePage}
					pageCount={pageCount}
					total={filteredRows.length}
					pageSize={table.pageSize}
					onPageChange={table.setPage}
					onPageSizeChange={table.setPageSize}
					hint={
						isFiltered ? `已筛选（共 ${allRows.length} 个属性）` : undefined
					}
				/>
			}
			rowActions={(row) => (
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={`复制 ${row.name}`}
					onClick={() => copyText(row.name, `已复制: ${row.name}`)}
				>
					<CopyIcon className="size-3.5" />
				</Button>
			)}
			actionsHeader="复制"
		/>
	);
}
