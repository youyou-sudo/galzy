import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarRail,
} from '@web/components/animate-ui/components/radix/sidebar'
import AuthYjvg from '@web/components/auth/authYjvg'
import NavMain from '@web/components/dashboard/sedebar/NavMain'
import NavUser from '@web/components/dashboard/sedebar/NavUser'
import Switcher from '@web/components/dashboard/sedebar/Switcher'
import SideContent from '@web/components/dashboard/sedebar/sideContent'
import { Toaster } from '@web/components/ui/sonner'
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
    <AuthYjvg>
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
        <SideContent>
          <div className="p-4">
            {children}
          </div>
        </SideContent>
        <Toaster position="top-center" />
      </SidebarProvider>
    </AuthYjvg>
  )
}
