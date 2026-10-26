import { useQuery } from "@tanstack/react-query";
import { Badge } from "@web/components/ui/badge";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Label } from "@web/components/ui/label";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@web/components/ui/tooltip";
import { getPropertyList } from "@web/server/admin/meilisearch";
import { SearchField } from "@web/components/shared/search-field";
import { CopyIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CardSkeleton, EmptyState, ErrorDisplay, ignoreAbort } from "./shared";
import type { IndexType } from "./types";

export function PropertiesTab({ indexType }: { indexType: IndexType }) {
	const [search, setSearch] = useState("");

	const {
		data,
		isLoading: loading,
		error,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: ["admin", "meiliProperties", indexType],
		queryFn: ignoreAbort(() => getPropertyList({ data: { indexType } })),
		staleTime: 5 * 60 * 1000,
	});

	const allProperties = useMemo(
		() =>
			Array.isArray(data)
				? data.filter((p): p is string => typeof p === "string")
				: [],
		[data],
	);

	const filtered = useMemo(() => {
		if (!search.trim()) return allProperties;
		const q = search.toLowerCase();
		return allProperties.filter((p) => p.toLowerCase().includes(q));
	}, [allProperties, search]);

	const handleCopyAll = async () => {
		try {
			await navigator.clipboard.writeText(allProperties.join("\n"));
			toast.success(`已复制 ${allProperties.length} 个属性名`);
		} catch {
			toast.error("复制失败");
		}
	};

	if (loading) {
		return (
			<Card>
				<CardSkeleton rows={3} />
			</Card>
		);
	}

	if (error) {
		const msg = error instanceof Error ? error.message : "加载失败";
		return (
			<Card>
				<CardContent className="pt-6">
					<ErrorDisplay message={msg} onRetry={() => refetch()} />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-2">
					<div>
						<CardTitle>属性列表</CardTitle>
						<CardDescription>
							索引文档中的所有可用属性字段（通过一篇示例文档提取）
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Controls */}
				<div className="flex flex-wrap items-end gap-3">
					<span className="pb-1.5 text-xs text-muted-foreground">
						目标索引:
						<span className="font-medium text-foreground ml-1">
							{indexType === "game"
								? "游戏"
								: indexType === "tag"
									? "标签"
									: "厂商"}
						</span>
					</span>
					<div className="min-w-[200px] flex-1 space-y-1.5">
						<Label>搜索过滤</Label>
						<SearchField
							value={search}
							onChange={setSearch}
							placeholder="输入属性名过滤…"
							ariaLabel="按属性名过滤"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleCopyAll}
						disabled={allProperties.length === 0}
						className="mb-0.5"
					>
						<CopyIcon className="size-3.5" />
						复制全部
					</Button>
				</div>

				{/* Stats */}
				<div className="flex items-center gap-3 text-xs text-muted-foreground">
					<span>
						共{" "}
						<span className="font-medium text-foreground">
							{allProperties.length}
						</span>{" "}
						个属性
					</span>
					{search && filtered.length !== allProperties.length && (
						<span>
							匹配{" "}
							<span className="font-medium text-foreground">
								{filtered.length}
							</span>{" "}
							个
						</span>
					)}
					{isFetching && <span>同步中...</span>}
				</div>

				{/* Property Tags */}
				{filtered.length > 0 ? (
					<div className="flex max-h-[400px] flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-muted/30 p-3 ring-1 ring-border/60">
						{filtered.map((prop) => (
							<Tooltip key={prop}>
								<TooltipTrigger
									render={
										<button
											type="button"
											className="cursor-pointer rounded focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
											onClick={async () => {
												try {
													await navigator.clipboard.writeText(prop);
													toast.success(`已复制: ${prop}`);
												} catch {
													toast.error("复制失败");
												}
											}}
										>
											<Badge
												variant="secondary"
												className="font-mono text-xs hover:bg-secondary/80 transition-colors"
											>
												{prop}
											</Badge>
										</button>
									}
								/>
								<TooltipContent>点击复制</TooltipContent>
							</Tooltip>
						))}
					</div>
				) : search ? (
					<EmptyState
						icon={SearchIcon}
						text="无匹配属性"
						description={`没有找到包含 "${search}" 的属性`}
					/>
				) : (
					<EmptyState text="索引中暂无文档或暂无属性数据" />
				)}
			</CardContent>
		</Card>
	);
}
