import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tags/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex justify-center items-center h-full text-[1.5rem]">
      该区域开发中
    </div>
  )
}
