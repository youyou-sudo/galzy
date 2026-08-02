import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { seoTemplate } from '@web/config/seoTemplate'
import { seoMeta } from '@web/lib/seo'

export const Route = createFileRoute('/producer/')({
  component: RouteComponent,
  head: () =>
    seoMeta({
      title: `厂商 | ${seoTemplate.title}`,
      description:
        '按厂商 / 开发会社浏览 GalZY 收录的 Galgame 作品，发现各会社的代表作与全部汉化游戏。',
      path: '/producer',
    }),
  headers: () => ({
    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
    'Cache-Tag': 'page-producers',
  }),
})

function RouteComponent() {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-0 space-y-4">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link to="/" />}>首页</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>厂商</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex justify-center items-center h-full text-[1.5rem]">
        该区域开发中
      </div>
    </div>
  )
}
