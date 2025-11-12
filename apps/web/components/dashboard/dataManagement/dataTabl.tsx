'use client'
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query'
import DataManagementPagination from '@web/components/dashboard/dataManagement/Pagination'
import { Button } from '@web/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@web/components/ui/card'
import { Input } from '@web/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select'
import { Skeleton } from '@web/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table'
import {
  dataFilteringGet,
  vidassociationCreate,
  vidassociationGet,
} from '@web/lib/dashboard/dataManagement/dataGet'
import { Loader2Icon, Plus, SquarePen, Swords } from 'lucide-react'
import React from 'react'
import EditDialog from './edit/EditDialog'
import { useFilterStore, usePaginationStore } from './stores/dataManagement'
import { useStrategyListDialog } from './stores/strategyListModal'
import { useEditDialog } from './stores/useEditDialog'
import { StrategyListModal } from './strategy/strategyList'

export default function DataTabl() {
  const filterNusq = useFilterStore((state) => state.filterNusq)
  const setFilterNusq = useFilterStore((state) => state.setFilterNusq)
  const getRequestParams = useFilterStore((state) => state.getRequestParams)
  const { datapage, limit, setDatapage, setLimit } = usePaginationStore()

  const [query, setQuery] = React.useState('')

  const { open, dataget } = useEditDialog()

  // 数据请求
  const { data: dataFilteringData, refetch } = useQuery({
    queryKey: ['dataFilteringGet', filterNusq, datapage, limit, query],
    queryFn: async () => {
      const params = {
        ...getRequestParams(filterNusq),
        page: datapage,
        limit,
        query: query,
      }
      const res = await dataFilteringGet(params)
      return res
    },
    refetchInterval: 6000,
  })

  const queryClient = new QueryClient()
  const {
    isPending,
    mutate: adddatass,
    isError,
  } = useMutation({
    mutationFn: async () => {
      const id = await vidassociationCreate()
      open()
      const data = await vidassociationGet(String(id?.id))
      dataget(data)
      refetch()
    },
    onSettled: () => queryClient.invalidateQueries(),
  })

  const { mutate: edithave, isPending: edithaveLoading } = useMutation({
    mutationFn: async (id: string) => {
      open()
      const data = await vidassociationGet(String(id!))
      dataget(data)
      refetch()
    },
    onSettled: () => queryClient.invalidateQueries(),
  })

  // const { mutate: delll, isPending: delllLoading } = useMutation({
  //   mutationFn: async (id: string) => {
  //     await vidassociationDelete(id!);
  //     refetch();
  //   },
  //   onSettled: () => queryClient.invalidateQueries(),
  // });

  const { open: strategyListDialogOpen, dataget: strategyListDialogDataget } =
    useStrategyListDialog()
  // [x] 数据翻页功能
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center space-x-4">
              <div>数据管理</div>
              {filterNusq}
              <div className="flex ml-auto space-x-4">
                {/* [x]  数据搜索
                 */}
                <Input
                  placeholder="ID"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                  }}
                />
                <Select
                  defaultValue={filterNusq!}
                  value={filterNusq!}
                  onValueChange={(value) => setFilterNusq(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="筛选" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>选项</SelectLabel>
                      <SelectItem value="All">ALL</SelectItem>
                      <SelectItem value="NoVndb">NO VNDB</SelectItem>
                      <SelectItem value="NotSupplemented">
                        未补充数据
                      </SelectItem>
                      <SelectItem value="Supplemented">已补充数据</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {/* [x] 添加条目功能
                [x] 条目编辑为弹窗
                 */}
                <Button
                  {...(isPending && { disabled: true })}
                  variant={isError ? 'destructive' : 'outline'}
                  onClick={() => {
                    adddatass()
                  }}
                >
                  {isPending ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  添加条目
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">otherId</TableHead>
                <TableHead>vid</TableHead>
                <TableHead>title</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataFilteringData?.data.map((item: any, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.other}</TableCell>
                  <TableCell>{item.vid}</TableCell>
                  <TableCell>
                    {item.otherdatas?.title?.[0]?.title || 'N/A'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        strategyListDialogOpen()
                        strategyListDialogDataget(item.vid || item.id)
                      }}
                    >
                      <Swords />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-8"
                      onClick={() => edithave(item.id)}
                    >
                      {edithaveLoading ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <SquarePen />
                      )}
                    </Button>
                    {/* [x] 数据删除 */}
                    {/* <Button
                      variant="secondary"
                      size="icon"
                      className="size-8 text-red-500"
                      onClick={() => {
                        delll(item.vid || item.id);
                      }}
                    >
                      {delllLoading ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <Trash2 animateOnHover />
                      )}
                    </Button> */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {dataFilteringData ? (
            <DataManagementPagination
              currentPage={dataFilteringData.pagination.page}
              totalPages={dataFilteringData.pagination.totalPages}
              setDatapage={(page: number) => setDatapage(page)}
              setLimit={(newLimit: number) => {
                setLimit(newLimit)
                setDatapage(1)
              }}
              limit={dataFilteringData.pagination.limit}
            />
          ) : (
            <div className="flex flex-col space-y-2 mt-4">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <Skeleton key={i} className="h-[40px] rounded-xl" />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
      <EditDialog />
      <StrategyListModal />
    </div>
  )
}
