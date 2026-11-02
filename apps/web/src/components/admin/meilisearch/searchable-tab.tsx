import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery } from "@tanstack/react-query";
import { StatusPill } from "@web/components/admin/admin-table";
import { Button } from "@web/components/ui/button";
import { Card, CardContent, CardHeader } from "@web/components/ui/card";
import { Label } from "@web/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@web/components/ui/select";
import { Separator } from "@web/components/ui/separator";
import { useAdminMutation } from "@web/hooks/use-admin-mutation";
import { adminKeys } from "@web/lib/admin/query-keys";
import { cn } from "@web/lib/utils";
import {
	getPropertyList,
	getSearchableAttributes,
	updateSearchableAttributes,
} from "@web/server/admin/meilisearch";
import { GripVerticalIcon, RotateCcwIcon, SaveIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	CardSkeleton,
	EmptyState,
	ErrorDisplay,
	extractError,
	ignoreAbort,
	indexTypeLabels,
	Panel,
	SectionHeader,
} from "./shared";
import type { IndexType } from "./types";

// ─── Sortable Field Item ──────────────────────────────────────

function SortableFieldItem({
	id,
	field,
	onRemove,
}: {
	id: string;
	field: string;
	onRemove: (field: string) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 50 : undefined,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex gap-2 items-center px-3 py-2 bg-background rounded-xl ring-1 ring-border/60"
		>
			<button
				className="shrink-0 text-muted-foreground rounded cursor-grab touch-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing"
				{...attributes}
				{...listeners}
				type="button"
				aria-label={`拖拽排序 ${field}`}
			>
				<GripVerticalIcon className="size-4" />
			</button>
			<span className="flex-1 font-mono text-xs truncate">{field}</span>
			<Button
				variant="ghost"
				size="icon"
				className="shrink-0 size-7 text-muted-foreground hover:text-destructive"
				onClick={() => onRemove(field)}
				type="button"
				aria-label={`移除 ${field}`}
			>
				<XIcon className="size-3.5" />
			</Button>
		</div>
	);
}

// ─── Main Tab ─────────────────────────────────────────────────

export function SearchableTab({ indexType }: { indexType: IndexType }) {
	// 可编辑字段列表（null = 跟随服务端）
	const [fields, setFields] = useState<string[] | null>(null);

	const {
		data: searchableData,
		isLoading,
		error,
		refetch,
		isFetching,
	} = useQuery({
		queryKey: adminKeys.meiliSearchable(indexType),
		queryFn: ignoreAbort(() =>
			getSearchableAttributes({ data: { indexType } }),
		),
		staleTime: 5 * 60 * 1000,
	});

	const { data: propertyList = [], isLoading: propertiesLoading } = useQuery({
		queryKey: adminKeys.meiliProperties(indexType),
		queryFn: ignoreAbort(() => getPropertyList({ data: { indexType } })),
		staleTime: 5 * 60 * 1000,
	});

	const safeSearchable = useMemo(
		() =>
			Array.isArray(searchableData)
				? searchableData.filter(
						(field): field is string => typeof field === "string",
					)
				: [],
		[searchableData],
	);

	const searchableHash = safeSearchable.join(",");

	// 服务端数据同步到本地编辑状态
	useEffect(() => {
		setFields((previous) => {
			if (previous === null) return [...safeSearchable];
			if (previous.join(",") === searchableHash) return previous;
			return [...safeSearchable];
		});
	}, [searchableHash]);

	const isDirty = useMemo(() => {
		if (fields === null) return false;
		if (fields.length !== safeSearchable.length) return true;
		return fields.some((field, index) => field !== safeSearchable[index]);
	}, [fields, safeSearchable]);

	// 可选字段
	const availableFields = useMemo(() => {
		if (!Array.isArray(propertyList)) return [];
		const current = fields ?? [];
		return propertyList.filter(
			(property): property is string =>
				typeof property === "string" && !current.includes(property),
		);
	}, [propertyList, fields]);

	// dnd sensors
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			setFields((items) => {
				if (!items) return items;
				const oldIndex = items.indexOf(active.id as string);
				const newIndex = items.indexOf(over.id as string);
				if (oldIndex === -1 || newIndex === -1) return items;
				return arrayMove(items, oldIndex, newIndex);
			});
		}
	};

	const handleRemove = useCallback((field: string) => {
		setFields((previous) =>
			previous ? previous.filter((item) => item !== field) : previous,
		);
	}, []);

	const handleReset = useCallback(() => {
		setFields([...safeSearchable]);
		toast.info("已还原至服务端数据");
	}, [safeSearchable]);

	// 保存：乐观把缓存字段改成提交内容，失败由 useAdminMutation 回滚
	const saveMutation = useAdminMutation<unknown, string[]>({
		mutationFn: (nextFields) =>
			updateSearchableAttributes({ data: { fields: nextFields, indexType } }),
		optimistic: (queryClient, nextFields) => {
			queryClient.setQueryData<string[]>(
				adminKeys.meiliSearchable(indexType),
				nextFields,
			);
		},
		affects: [
			adminKeys.meiliSearchable(indexType),
			adminKeys.meiliProperties(indexType),
			adminKeys.meiliStats(),
		],
		successMessage: "搜索属性已更新",
		errorMessage: (error) => `保存失败：${extractError(error)}`,
	});

	const handleSave = useCallback(() => {
		if (!fields || fields.length === 0) {
			toast.error("请至少保留一个搜索属性字段");
			return;
		}
		saveMutation.mutate(fields);
	}, [fields, saveMutation]);

	// ─── Render States ──────────────────────────────────────────

	if (isLoading) {
		return (
			<Card>
				<CardSkeleton rows={4} />
			</Card>
		);
	}

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

	const currentFields = fields ?? [];
	const isRefreshing = isFetching && !isLoading;
	const isSaving = saveMutation.isPending;

	return (
		<Card>
			<CardHeader>
				<SectionHeader
					title="搜索属性"
					description="拖拽排序，配置索引中可被全文搜索的字段。含 * 表示所有字段可搜索（自动展开为字段列表）。"
					action={
						<div className="flex gap-2 items-center">
							{isDirty && (
								<StatusPill tone="warning">有未保存的更改</StatusPill>
							)}
							{isSaving && (
								<StatusPill tone="info" spin icon={SaveIcon}>
									保存中
								</StatusPill>
							)}
							{isDirty && (
								<Button
									variant="ghost"
									size="sm"
									onClick={handleReset}
									disabled={isSaving}
									className="text-muted-foreground"
								>
									<RotateCcwIcon className="size-3" />
									还原
								</Button>
							)}
						</div>
					}
				/>
			</CardHeader>
			<CardContent
				className={cn(
					"flex flex-col gap-4 transition-opacity duration-200",
					(isRefreshing || isSaving) && "opacity-70",
				)}
			>
				<div className="flex flex-wrap gap-3 items-center text-xs">
					<span className="text-muted-foreground">
						目标索引：
						<span className="font-medium text-foreground">
							{indexTypeLabels[indexType]}
						</span>
					</span>
					<span className="text-muted-foreground tabular-nums">
						字段数：
						<span className="font-medium text-foreground">
							{currentFields.length}
						</span>
					</span>
					{isRefreshing && (
						<span className="text-muted-foreground">同步中…</span>
					)}
				</div>

				<Separator />

				<div className="flex flex-col gap-3">
					<Label>当前字段</Label>
					{currentFields.length === 0 ? (
						<EmptyState
							text="暂无搜索字段"
							description="从下方下拉框添加需要参与全文检索的字段"
						/>
					) : (
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={currentFields}
								strategy={verticalListSortingStrategy}
							>
								<Panel className="overflow-y-auto p-2 space-y-1.5 max-h-80">
									{currentFields.map((field) => (
										<SortableFieldItem
											key={field}
											id={field}
											field={field}
											onRemove={handleRemove}
										/>
									))}
								</Panel>
							</SortableContext>
						</DndContext>
					)}

					<div className="flex flex-col gap-1.5">
						<Label className="text-xs text-muted-foreground">添加字段</Label>
						<Select
							value=""
							onValueChange={(value) => {
								if (!value) return;
								setFields((previous) => {
									if (!previous) return [value];
									if (previous.includes(value)) return previous;
									return [...previous, value];
								});
							}}
							disabled={propertiesLoading || availableFields.length === 0}
						>
							<SelectTrigger>
								<SelectValue
									placeholder={
										propertiesLoading
											? "加载可用字段中..."
											: availableFields.length === 0
												? currentFields.length === 0
													? "索引暂无可用字段"
													: "所有字段已添加"
												: "选择要添加的字段..."
									}
								/>
							</SelectTrigger>
							<SelectContent className="max-h-60">
								{availableFields.map((property) => (
									<SelectItem key={property} value={property}>
										<span className="font-mono text-xs">{property}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<Separator />

				<div className="flex flex-wrap gap-3 items-center">
					<Button
						onClick={handleSave}
						disabled={isSaving || !isDirty || fields === null}
					>
						<SaveIcon className={cn("size-4", isSaving && "animate-pulse")} />
						保存属性
					</Button>
					{!isDirty && !isSaving && (
						<span className="text-xs text-muted-foreground">已是最新配置</span>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
