import { createFileRoute, redirect } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { elysiaErrorF } from '@web/lib'
import { getSession, listAccounts } from '@web/server/auth/auth.functions'
import { z } from 'zod'

const UserPage = lazy(() => import('@web/components/user/user-page'))

const UserSearchSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const Route = createFileRoute('/user/')({
  component: () => {
    const session = Route.useLoaderData()
    const { error, error_description } = Route.useSearch()
    return (
      <Suspense fallback={<div>加载中...</div>}>
        <UserPage session={session} error={error} error_description={error_description} />
      </Suspense>
    )
  },
  validateSearch: UserSearchSchema,
  loader: async ({ context }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/auth/login' })
    }

    await context.queryClient.ensureQueryData({
      queryKey: ['linked-accounts'],
      queryFn: async () => {
        const { data, error } = await listAccounts()
        elysiaErrorF(error)
        return data ?? []
      },
    })

    return session
  },
})
