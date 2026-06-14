import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CheckCircle2Icon,
  GripVerticalIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ErrorDisplay, ignoreAbort, LoadingSpinner } from './shared'

/** 单个可拖拽字段行 */
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
      className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
        type="button"
        aria-label="拖拽排序"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <span className="flex-1 font-mono text-sm truncate">{field}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onRemove(field)}
        type="button"
        aria-label={`删除 ${field}`}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}

export function SearchableTab() {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['meiliSearchable'],
    queryFn: ignoreAbort(getSearchableAttributes),
  })

  const { data: propertyList, isLoading: loadingProps } = useQuery({
    queryKey: ['meiliProperties'],
    queryFn: ignoreAbort(getPropertyList),
  })

  const [fields, setFields] = useState<string[]>([])
  const [addField, setAddField] = useState('')

  // 数据加载后回填
  useEffect(() => {
    if (data) {
      setFields(Array.isArray(data) ? [...data] : [])
    }
  }, [data])

  // 尚未添加的可用字段
  const availableFields = useMemo(() => {
    const props = Array.isArray(propertyList) ? (propertyList as string[]) : []
    return props.filter((p) => !fields.includes(p))
  }, [propertyList, fields])

  const saveMutation = useMutation({
    mutationFn: () => {
      return updateSearchableAttributes({ data: { fields } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meiliSearchable'] })
      toast.success('搜索属性已更新')
    },
    onError: (e: Error) => {
      toast.error(e.message ?? '更新失败')
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleAdd = () => {
    if (addField && !fields.includes(addField)) {
      setFields((prev) => [...prev, addField])
      setAddField('')
    }
  }

  const handleRemove = (field: string) => {
    setFields((prev) => prev.filter((f) => f !== field))
    // 如果正在选中待添加的就是被删的字段，清除选中
    if (addField === field) setAddField('')
  }

  const handleSave = () => {
    if (fields.length === 0) {
      toast.error('请至少输入一个属性字段')
      return
    }
    saveMutation.mutate()
  }

  if (loading) return <LoadingSpinner text="正在加载搜索属性..." />
  if (error) {
    const msg = error instanceof Error ? error.message : '加载失败'
    return <ErrorDisplay message={msg} onRetry={() => refetch()} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>搜索属性</CardTitle>
        <CardDescription>
          拖拽排序，配置哪些字段可被搜索。含{' '}
          <code className="text-xs bg-muted px-1 rounded">*</code>{' '}
          表示全部字段可搜索。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 可拖拽排序的字段列表 */}
        <div className="space-y-2">
          <Label>字段列表</Label>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
              暂无字段，请从下方添加
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {fields.map((field) => (
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
        </div>

        {/* 添加字段 */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label>添加字段</Label>
            <Select value={addField} onValueChange={setAddField}>
              <SelectTrigger
                disabled={loadingProps || availableFields.length === 0}
              >
                <SelectValue
                  placeholder={
                    loadingProps
                      ? '加载可用字段中...'
                      : availableFields.length === 0
                        ? '所有字段已添加'
                        : '选择要添加的字段...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((prop) => (
                  <SelectItem key={prop} value={prop}>
                    <span className="font-mono text-xs">{prop}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAdd}
            disabled={!addField}
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label="添加字段"
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>

        <Separator />
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Spinner className="size-4 mr-1" />
            ) : (
              <CheckCircle2Icon className="size-4 mr-1" />
            )}
            保存属性
          </Button>
          <span className="text-xs text-muted-foreground">
            当前: {fields.length} 个字段
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
