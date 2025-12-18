'use client'
import type { StrategyModel } from '@api/modules/strategy/model'
import { useMutation, useQuery } from '@tanstack/react-query'
import { MotionHighlight } from '@web/components/animate-ui/effects/motion-highlight'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@web/components/animate-ui/components/radix/dialog'
import ForesightLink from '@web/components/HoverPLink'
import { Button } from '@web/components/ui/button'
import { Skeleton } from '@web/components/ui/skeleton'
import { authClient } from '@web/lib/auth/auth-client'
import {
  strategyListDelete,
  strategyListGet,
} from '@web/lib/strategy/strategyAc'
import { Loader2Icon, NotepadText, Pencil, Trash } from 'lucide-react'
import { usePathname } from 'next/navigation'
import React from 'react'
import { useStrategyListDialog } from '../stores/strategyListModal'
import { useLoginModalStore } from './stores/EditStores'
import { StrategEdit } from './strategyEdit'

// [x] 攻略列表
// [x] 攻略增删改
const StrategyList = ({ id }: { id: string }) => {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => authClient.getSession(),
    staleTime: 0,
    refetchOnMount: true,
  })

  const {
    data: strategyList,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['strategyList', id],
    queryFn: () => strategyListGet(id),
  })
  const { mutate: SubmitAc, isPending: SubmitAcLoading } = useMutation({
    mutationFn: async ({ gameId, strategyId }: StrategyModel.strategy) => {
      try {
        await strategyListDelete({ gameId, strategyId })
        await refetch()
      } catch (e) {
        console.log(e)
      }
    },
  })

  const { setdata, setcreate, openModal } = useLoginModalStore()
  const pathname = usePathname()
  return (
    <article>
      <div className="flex flex-col p-3">
        {isLoading &&
          Array(2)
            .fill(null)
            .map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
        {!isLoading && (!strategyList || strategyList.length === 0) && (
          <div className="text-center">暂无攻略文章喵～</div>
        )}

        {strategyList && (
          <MotionHighlight hover className="rounded-lg">
            {strategyList.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-2 space-x-2 rounded-lg"
              >
                <ForesightLink
                  className="w-full"
                  href={
                    pathname === '/dashboard/dataManagement'
                      ? `/${id}/${item.id}`
                      : `${item.id}`
                  }
                >
                  <div className="pt-2 flex items-center pb-2 w-full">
                    <NotepadText className="w-4 h-4" />
                    <span>{item.title}</span>
                  </div>
                </ForesightLink>
                {user?.data?.user.role === 'admin' && (
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => {
                        setcreate(false)
                        setdata({
                          id: String(item.id),
                          data: {
                            title: item.title!,
                            content: item.content!,
                            copyright: item.copyright,
                          },
                        })
                        openModal()
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => {
                        SubmitAc({
                          gameId: id,
                          strategyId: item.id,
                        })
                      }}
                    >
                      {SubmitAcLoading ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <Trash />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </MotionHighlight>
        )}
      </div>

      {user?.data?.user.role === 'admin' && (
        <div className="pt-2 items-center justify-center p-3">
          <Button
            className="h-11 w-full"
            variant="outline"
            size="sm"
            onClick={() => {
              openModal()
              setdata({ id: id })
              setcreate(true)
            }}
          >
            <Pencil />
            添加攻略文章
          </Button>
        </div>
      )}
      <StrategEdit />
    </article>
  )
}

export default StrategyList

export const StrategyListModal = () => {
  const { isOpen, toggleModal, id } = useStrategyListDialog()
  return (
    <Dialog open={isOpen} onOpenChange={toggleModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>攻略列表</DialogTitle>
        </DialogHeader>
        <StrategyList id={id!} />
      </DialogContent>
    </Dialog>
  )
}
