import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarRail,
} from '@web/components/animate-ui/radix/sidebar'
import NavMain from '@web/components/dashboard/sedebar/NavMain'
import NavUser from '@web/components/dashboard/sedebar/NavUser'
import Switcher from '@web/components/dashboard/sedebar/Switcher'
import SideContent from '@web/components/dashboard/sedebar/sideContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GalZY - Dashboard',
  description: '后台界面',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <Switcher />
          <NavMain />
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SideContent>{children}</SideContent>
    </SidebarProvider>
  )
}
