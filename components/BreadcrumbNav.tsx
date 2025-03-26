"use client";
import React from "react";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { mainMenuItems, settingsMenuItems } from "@/config/site";
import Link from "next/link";

export default function BreadcrumbNav({ className }: { className?: string }) {
  const pathname = usePathname();

  const pathSegments = pathname.split("/").filter((segment) => segment !== "");

  const allMenuItems = [...mainMenuItems, ...settingsMenuItems];

  return (
    <div className={className}>
      <Breadcrumb>
        <BreadcrumbList>
          {pathSegments.map((segment, index) => {
            const path = "/" + pathSegments.slice(0, index + 1).join("/");
            const menuItem = allMenuItems.find((item) => item.path === path);
            const title = menuItem?.title || segment;

            return (
              <React.Fragment key={path}>
                <BreadcrumbItem>
                  {index === pathSegments.length - 1 ? (
                    <BreadcrumbPage>{title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={path}>{title}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
