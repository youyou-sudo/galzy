import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Label } from '@web/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select'
import { Separator } from '@web/components/ui/separator'
import { Spinner } from '@web/components/ui/spinner'
import {
  getPropertyList,
  getSearchableAttributes,
  updateSearchableAttributes,
} from '@web/server/admin/meilisearch'
import {
  CheckCircle2Icon,
  GripVerticalIcon,
  RotateCcwIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CardSkeleton,
  EmptyState,
  ErrorDisplay,
  extractError,
  ignoreAbort,
} from './shared'
import type { IndexType } from './types'

// ─── Sortable Field Item ──────────────────────────────────────

function SortableFieldItem({
  id,
  field,
  onRemove,
}: {
  id: string
  field: string
  onRemove: (field: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 shadow-sm"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0"
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
        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onRemove(field)}
        type="button"
        aria-label={`移除 ${field}`}
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────

export function SearchableTab({ indexType }: { indexType: IndexType }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  // 可编辑字段列表
  const [fields, setFields] = useState<string[] | null>(null)

  // 搜索属性
  const {
    data: searchableData,
    isLoading: searchableLoading,
    error: searchableError,
    refetch: refetchSearchable,
    isFetching: searchableFetching,
  } = useQuery({
    queryKey: ['admin', 'meiliSearchable', indexType],
    queryFn: ignoreAbort(() =>
      getSearchableAttributes({ data: { indexType } }),
    ),
    staleTime: 5 * 60 * 1000,
  })

  // 属性列表（用于下拉选择）
  const { data: propertyList = [], isLoading: propsLoading } = useQuery({
    queryKey: ['admin', 'meiliProperties', indexType],
    queryFn: ignoreAbort(() => getPropertyList({ data: { indexType } })),
    staleTime: 5 * 60 * 1000,
  })

  const safeSearchable = useMemo(
    () =>
      Array.isArray(searchableData)
        ? searchableData.filter((f): f is string => typeof f === 'string')
        : [],
    [searchableData],
  )

  const searchableHash = safeSearchable.join(',')

  // 服务端数据同步到本地编辑状态
  useEffect(() => {
    setFields((prev) => {
      if (prev === null) return [...safeSearchable]
      const prevHash = prev.join(',')
      if (prevHash === searchableHash) return prev
      return [...safeSearchable]
    })
  }, [searchableHash])

  const isDirty = useMemo(() => {
    if (fields === null) return false
    if (fields.length !== safeSearchable.length) return true
    return fields.some((f, i) => f !== safeSearchable[i])
  }, [fields, safeSearchable])

  // 可选字段
  const availableFields = useMemo(() => {
    if (!Array.isArray(propertyList)) return []
    const current = fields ?? []
    return propertyList.filter(
      (p) => typeof p === 'string' && !current.includes(p),
    )
  }, [propertyList, fields])

  // dnd sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setFields((items) => {
        if (!items) return items
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        if (oldIndex === -1 || newIndex === -1) return items
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleRemove = useCallback((field: string) => {
    setFields((prev) => (prev ? prev.filter((f) => f !== field) : prev))
  }, [])

  const handleReset = useCallback(() => {
    setFields([...safeSearchable])
    toast.info('已还原至服务端数据')
  }, [safeSearchable])

  const handleSave = useCallback(async () => {
    if (!fields || fields.length === 0) {
      toast.error('请至少保留一个搜索属性字段')
      return
    }
    setSaving(true)
    try {
      await updateSearchableAttributes({ data: { fields, indexType } })
      toast.success('搜索属性已更新')
      queryClient.invalidateQueries({
        queryKey: ['admin', 'meiliSearchable', indexType],
      })
    } catch (e) {
      toast.error(extractError(e))
    } finally {
      setSaving(false)
    }
  }, [fields, indexType, queryClient])

  // ─── Render States ──────────────────────────────────────────

  if (searchableLoading) {
    return (
      <Card>
        <CardSkeleton rows={4} />
      </Card>
    )
  }

  if (searchableError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorDisplay
            message={extractError(searchableError)}
            onRetry={() => refetchSearchable()}
          />
        </CardContent>
      </Card>
    )
  }

  const currentFields = fields ?? []
  const isRefreshing = searchableFetching && !searchableLoading

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>搜索属性</CardTitle>
            <CardDescription>
              拖拽排序，配置索引中可被全文搜索的字段。含{' '}
              <code className="text-xs bg-muted px-1 rounded">*</code>{' '}
              表示所有字段可搜索（自动展开为字段列表）。
            </CardDescription>
          </div>
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground shrink-0"
            >
              <RotateCcwIcon className="size-3" />
              还原
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status Bar */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            目标索引:
            <span className="font-medium text-foreground ml-1">
              {indexType === 'game' ? '游戏' : indexType === 'tag' ? '标签' : '厂商'}
            </span>
          </span>
          {isDirty && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              有未保存的更改
            </span>
          )}
          {isRefreshing && (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Spinner className="size-3" />
              同步中...
            </span>
          )}
        </div>

        <Separator />

        {/* Field List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>
              当前字段
              <span className="text-xs text-muted-foreground ml-2 font-normal">
                {currentFields.length} 个
              </span>
            </Label>
          </div>

          {currentFields.length === 0 ? (
            <EmptyState text="暂无搜索字段，请从下方添加" />
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
                <div className="space-y-1.5 max-h-80 overflow-y-auto rounded-lg border p-2 bg-muted/30">
                  {currentFields.map((field) => (
                    <SortableFieldItem
                      key={field}
                      id={field}
                      field={field}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add Field */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">添加字段</Label>
              <Select
                value=""
                onValueChange={(v) => {
                  if (!v) return
                  setFields((prev) => {
                    if (!prev) return [v]
                    if (prev.includes(v)) return prev
                    return [...prev, v]
                  })
                }}
                disabled={propsLoading || availableFields.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      propsLoading
                        ? '加载可用字段中...'
                        : availableFields.length === 0
                          ? currentFields.length === 0
                            ? '索引暂无可用字段'
                            : '所有字段已添加'
                          : '选择要添加的字段...'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableFields.map((prop) => (
                    <SelectItem key={prop} value={prop}>
                      <span className="font-mono text-xs">{prop}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty || fields === null}
          >
            {saving ? (
              <Spinner className="size-4" />
            ) : (
              <CheckCircle2Icon className="size-4" />
            )}
            保存属性
          </Button>
          {!isDirty && !saving && (
            <span className="text-xs text-muted-foreground">已是最新配置</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
