import type { Metadata } from "next";

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/animate-ui/radix/sidebar";
import Switcher from "@/components/dashboard/sedebar/Switcher";
import NavMain from "@/components/dashboard/sedebar/NavMain";
import NavUser from "@/components/dashboard/sedebar/NavUser";
import SideContent from "@/components/dashboard/sedebar/sideContent";

export const metadata: Metadata = {
  title: "GalZY - Dashboard",
  description: "后台界面",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
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
    </>
  );
}
