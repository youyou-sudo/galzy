'use client'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@web/components/animate-ui/radix/collapsible'

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@web/components/animate-ui/radix/sidebar'
import ForesightLink from '@web/components/HoverPLink'
import { dashboardConfig } from '@web/config/dashboard'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

export default function NavMain() {
  return (
    <>
      {/* Nav Main */}
      <SidebarGroup>
        <SidebarGroupLabel>Platform</SidebarGroupLabel>
        <SidebarMenu>
          {dashboardConfig.navMain.map((item) => (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          <ForesightLink href={subItem.url}>
                            <span>{subItem.title}</span>
                          </ForesightLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroup>
      {/* Nav Main */}
    </>
  )
}
