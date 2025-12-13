'use client'

import { Button } from '@shadcn/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shadcn/ui/components/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@shadcn/ui/components/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@shadcn/ui/components/popover'
import { Skeleton } from '@shadcn/ui/components/skeleton'
import { cn } from '@shadcn/ui/lib/utils'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  meilisearchPropertylist,
  meilisearcSearchableAttributeshGet,
  meilisearcSearchableAttributeshUpdate,
} from '@web/lib/dashboard/config/meilisearch'
import {
  Check,
  ChevronsUpDown,
  GripVertical,
  Loader2Icon,
  Plus,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'

export function MeiliSearchIndex() {
  const { data, isLoading } = useQuery({
    queryKey: ['meilisearcSearchableAttributesh'],
    queryFn: meilisearcSearchableAttributeshGet,
  })

  const [fields, setFields] = useState<string[]>([])

  useEffect(() => {
    if (data) {
      setFields(data)
    }
  }, [data])

  const { data: allAvailableFields, refetch: refetchFields } = useQuery({
    queryKey: ['meilisearchPropertylist'],
    queryFn: meilisearchPropertylist,
  })

  const { mutate: upData, isPending: updateLoading } = useMutation({
    mutationFn: async (fields: string[]) => {
      await meilisearcSearchableAttributeshUpdate({ fields })
      refetchFields()
    },
  })

  const [open, setOpen] = useState(false)
  const [selectedField, setSelectedField] = useState('')
  const [draggedItem, setDraggedItem] = useState<string | null>(null)

  const availableFields = allAvailableFields?.filter(
    (field) => !fields.includes(field),
  )

  const handleDragStart = (e: React.DragEvent, fieldName: string) => {
    setDraggedItem(fieldName)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetField: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetField) return

    const draggedIndex = fields.indexOf(draggedItem)
    const targetIndex = fields.indexOf(targetField)

    const newFields = [...fields]
    const [draggedField] = newFields.splice(draggedIndex, 1)
    newFields.splice(targetIndex, 0, draggedField)

    setFields(newFields)
    setDraggedItem(null)
  }

  const addField = () => {
    if (!selectedField) return

    setFields([...fields, selectedField])
    setSelectedField('')
    setOpen(false)
  }

  const removeField = (fieldName: string) => {
    setFields(fields.filter((f) => f !== fieldName))
  }

  const handleSave = () => {
    upData(fields)
    // ACTION
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full max-w-112.5" />
        ))}
      </div>
    )
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>可搜索字段</CardTitle>
        <CardDescription>选择索引匹配字段及优先级</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 字段列表 */}
        <div className="space-y-2">
          {fields.map((field) => (
            <div
              key={field}
              draggable
              onDragStart={(e) => handleDragStart(e, field)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, field)}
              className={cn(
                'flex items-center gap-2 p-2 rounded-md border bg-card transition-colors',
                'hover:bg-accent/50 cursor-move',
                draggedItem === field && 'opacity-50',
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{field}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeField(field)}
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="flex-1 justify-between text-sm bg-transparent"
                disabled={availableFields?.length === 0}
              >
                {selectedField || '选择字段...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-50 p-0">
              <Command>
                <CommandInput placeholder="搜索字段..." className="h-9" />
                <CommandList>
                  <CommandEmpty>未找到字段</CommandEmpty>
                  <CommandGroup>
                    {availableFields?.map((field) => (
                      <CommandItem
                        key={field}
                        value={field}
                        onSelect={(currentValue: any) => {
                          setSelectedField(
                            currentValue === selectedField ? '' : currentValue,
                          )
                        }}
                      >
                        {field}
                        <Check
                          className={cn(
                            'ml-auto h-4 w-4',
                            selectedField === field
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button onClick={addField} size="sm" disabled={!selectedField}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* 保存按钮 */}
        <Button
          onClick={handleSave}
          className="w-full"
          size="sm"
          disabled={updateLoading}
        >
          {updateLoading && <Loader2Icon className="animate-spin" />}
          保存配置
        </Button>
      </CardContent>
    </Card>
  )
}
