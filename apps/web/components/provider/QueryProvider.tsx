'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { useState } from 'react'

interface Props {
  children: React.ReactNode
}

export default function QueryProvider({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        retry: 1,
        networkMode: 'always',
      },
    },
  }))
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
