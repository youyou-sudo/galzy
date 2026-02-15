'use client'
import {
  SidebarInset,
  SidebarTrigger,
} from '@web/components/animate-ui/components/radix/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@web/components/ui/breadcrumb'
import { Separator } from '@web/components/ui/separator'
import { House } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type React from 'react'

const pathNameMap: Record<string, string> = {
  '/dashboard': '管理面板',
  '/dashboard/config': '站点配置',
  '/dashboard/dataManagement': '数据管理',
  '/dashboard/tag': '标签管理',
  '/dashboard/download': '下载管理',
}

export default function SideContent({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const currentPageName = pathNameMap[pathname] || '页面'

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">
                  <House className="w-4 h-4" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              {pathname !== '/dashboard' && (
                <>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{currentPageName}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
    </SidebarInset>
  )
}
