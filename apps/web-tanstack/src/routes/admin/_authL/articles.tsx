import { createFileRoute } from '@tanstack/react-router'
import ArticlesPage from '@web/components/admin/articles-page'
import { adminGetAllArticles } from '@web/server/admin/articles'

export const Route = createFileRoute('/admin/_authL/articles')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: [
        'admin-all-articles',
        { searchValue: '', status: '', type: '', offset: 0, limit: 20 },
      ],
      queryFn: async () => {
        const res = await adminGetAllArticles({
          data: { page: 1, limit: 20 },
        })
        return res as any
      },
    })
  },
  component: ArticlesPage,
})
