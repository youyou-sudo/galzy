import { TagTable } from '@web/components/dashboard/tag/tabCard'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import React from 'react'
import { UpComp } from './UpComp'

export default async function page() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">标签管理</h1>
        <p className="text-muted-foreground">
          编辑和管理系统标签，组织您的内容分类
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>标签列表</CardTitle>
              <CardDescription>
                查看和编辑所有标签，支持批量操作
              </CardDescription>
            </div>
            <UpComp />
          </div>
        </CardHeader>
        <CardContent>
          <TagTable />
        </CardContent>
      </Card>
    </div>
  )
}
