import { api } from '@libs'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { Send } from 'lucide-react'
import { Suspense } from 'react'
import { elysiaErrorF } from '@web/lib'
import { Skeleton } from '../ui/skeleton'

export default function CountComponent() {
  return (
    <div className="flex items-center justify-center text-center my-2">
      <span className="pl-1 flex opacity-50">
        共收录了：
        <Suspense fallback={<Skeleton className="w-10 h-6 justify-center" />}>
          <Count />
        </Suspense>
        条目
      </span>
      <span className="inline-flex items-center gap-1 ml-2">
        <a
          className="underline text-blue-500 hover:text-blue-300"
          target="_blank"
          href="https://t.me/ziyuanlinyin"
          rel="noopener"
        >
          频道
        </a>
        <Send size={15} className="text-blue-400" />
      </span>
    </div>
  )
}

const getTotalCount = createServerFn().handler(async () => {
  const { data: totalRes, error } = await api.games.count.get()
  elysiaErrorF(error)
  return { totalCountResult: totalRes }
})

const Count = () => {
  const { data } = useSuspenseQuery({
    queryKey: ['totalCount'],
    queryFn: () => getTotalCount({}),
  })

  return <>{data.totalCountResult}</>
}
