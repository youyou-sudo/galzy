import { createFileRoute } from '@tanstack/react-router'
import { CommentItem } from '@web/components/cmments'
import { ReplyEidtInput } from '@web/components/cmments/reply-edit-input'
import { getCmments } from '@web/server/comments'

export const Route = createFileRoute('/$id/_layout/comment')({
  component: RouteComponent,
  loader: async ({ params: { id } }) => {
    return {
      id,
      commentsData: await getCmments({
        data: {
          targetType: 'game',
          targetId: id,
        },
      }),
    }
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=5, stale-while-revalidate=600',
  }),
})

function RouteComponent() {
  const { id } = Route.useLoaderData()
  return (
    <div>
      <ReplyEidtInput targetId={id} commentscomp={true} targetType="game" />
      <CommentItem targetType="game" />
    </div>
  )
}
