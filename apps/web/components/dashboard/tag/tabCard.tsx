'use client'
import { Button } from '@shadcn/ui/components/button'
import { Checkbox } from '@shadcn/ui/components/checkbox'
import { Input } from '@shadcn/ui/components/input'
import { Skeleton } from '@shadcn/ui/components/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@shadcn/ui/components/table'
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { tagAllAction, tagEditAction } from './(action)/action'
import { useTagEditDialog } from './stort'
import { TagDialogEdit } from './tagEditModal'
import TagPagination from './tagpagination'

export function TagTable() {
  const [page] = useQueryState('page')
  const [pageSize] = useQueryState('pagesize')
  const [keyword, setKeyword] = useQueryState('keyword')
  const [id, setId] = useQueryState('id')
  const {
    data: tagDatas,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['TagTable', pageSize, Number(page), keyword, id],
    queryFn: async () => {
      const res = await tagAllAction({
        pageSize: Number(pageSize) || 10,
        pageIndex: Number(page) || 1,
        keyword: keyword || undefined,
        id: id || undefined,
      })
      return res
    },
    refetchInterval: 60000,
  })
  const pageCount = tagDatas?.totalPages ?? 1

  const { open, dataget } = useTagEditDialog()
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          value={keyword || ''}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索"
        />
        <Input
          value={id || ''}
          onChange={(e) => setId(e.target.value)}
          placeholder="ID"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>别名</TableHead>
            <TableHead>描述</TableHead>
            <TableHead className="text-right">编辑</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tagDatas?.items.map((item, index) => (
            <TableRow key={index} className="overflow-hidden">
              <TableCell className="font-medium">{item.id}</TableCell>
              <TableCell>{item.zh_name}</TableCell>
              <TableCell>
                <div className="truncate max-w-sm">{item.zh_alias}</div>
              </TableCell>
              <TableCell>
                <div className="truncate max-w-xs">{item.zh_description}</div>
              </TableCell>
              <TableCell className="text-right flex items-center gap-2 justify-end">
                <Checkbox
                  checked={item.exhibition}
                  onCheckedChange={async () => {
                    await tagEditAction({
                      id: item.id,
                      zh_name: item.zh_name || '',
                      exhibition: !item.exhibition,
                      zh_alias: item.zh_alias || '',
                      zh_description: item.zh_description || '',
                    })
                    await refetch()
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    dataget(item)
                    open()
                  }}
                >
                  <Pencil />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {isLoading &&
        Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-[40px] my-2 w-full rounded-full" />
        ))}
      {/* 分页器 */}
      {!isLoading && (
        <div className="flex items-center justify-center">
          <TagPagination
            currentPage={Number(page) || 1}
            totalPages={pageCount}
          />
        </div>
      )}
      <TagDialogEdit />
    </div>
  )
}
