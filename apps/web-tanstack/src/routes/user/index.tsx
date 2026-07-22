import { createFileRoute, redirect } from '@tanstack/react-router'
import UserPage from '@web/components/user/user-page'
import { elysiaErrorF } from '@web/lib'
import { getSession, listAccounts } from '@web/server/auth/auth.functions'
import { z } from 'zod'

const UserSearchSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
})

export const Route = createFileRoute('/user/')({
  component: () => {
    const session = Route.useLoaderData()
    const { error, error_description } = Route.useSearch()
    return <UserPage session={session} error={error} error_description={error_description} />
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
