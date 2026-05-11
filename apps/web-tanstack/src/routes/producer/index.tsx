import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/producer/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/producer/"!</div>
}
