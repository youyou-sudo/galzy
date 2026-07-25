import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

const defaultOptions = {
  queries: {
    gcTime: 60_000,
    staleTime: 30_000,
  },
} as const

export function getContext() {
  const queryClient = new QueryClient({ defaultOptions })

  return { queryClient }
}

export default function TanStackQueryProvider({
  children,
}: {
  children: ReactNode
}) {
  const router = useRouter()
  const { queryClient } = router.options.context as {
    queryClient: QueryClient
  }

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
