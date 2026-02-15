'use client'
import {
  meiliSearchAddContenAc,
  meiliSearchAddTagAc,
  OpenlistAc,
  WorkerDataAC,
} from '@web/app/(dashboard)/dashboard/(action)/action'
import { Button } from '@web/components/ui/button'
import { Database, ListTodo, RefreshCw, Tag } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'

export function ButtonCard() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleAction = async (
    action: () => Promise<void>,
    actionName: string
  ) => {
    setLoading(actionName)
    try {
      await action()
      toast.success(`${actionName} 任务提交成功`)
    } catch (error) {
      toast.error(`${actionName}  任务提交失败`)
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  const actions = [
    {
      name: '同步 Openlist',
      description: '同步 Openlist 数据',
      icon: ListTodo,
      action: OpenlistAc,
      variant: 'default' as const,
    },
    {
      name: '同步 Worker 数据',
      description: '更新 Worker 节点数据',
      icon: RefreshCw,
      action: WorkerDataAC,
      variant: 'secondary' as const,
    },
    {
      name: '添加内容到搜索',
      description: '将内容添加到 MeiliSearch',
      icon: Database,
      action: meiliSearchAddContenAc,
      variant: 'outline' as const,
    },
    {
      name: '添加标签到搜索',
      description: '将标签添加到 MeiliSearch',
      icon: Tag,
      action: meiliSearchAddTagAc,
      variant: 'outline' as const,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {actions.map((item) => {
        const Icon = item.icon
        const isLoading = loading === item.name
        return (
          <div
            key={item.name}
            className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="p-2 rounded-md bg-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">
                {item.description}
              </div>
              <Button
                size="sm"
                variant={item.variant}
                disabled={isLoading}
                onClick={() => handleAction(item.action, item.name)}
                className="mt-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                    执行中...
                  </>
                ) : (
                  '执行'
                )}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
