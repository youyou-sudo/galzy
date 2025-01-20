"use client";

import React from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
} from "@nextui-org/react";
import { usePathname } from "next/navigation";
import { FormDown } from "grommet-icons";

import { siteConfig } from "@/config/site";
import Link from "next/link";

export const NavigationCandidates = () => {
  const currentPath = usePathname();

  const currentNavItem = siteConfig.navItems.find(
    (item) => item.href === currentPath
  );

  return (
    <Dropdown>
      <DropdownTrigger>
        <Chip
          color="default"
          className="ml-[10px]"
          endContent={<FormDown className="ml-[0px]" size="18px" />}
          variant="faded"
        >
          {currentNavItem ? currentNavItem.label : "主页?"}
        </Chip>
      </DropdownTrigger>
      <DropdownMenu aria-label="Link Actions" items={siteConfig.navItems}>
        {(item) => (
          <DropdownItem as={Link} key={item.href} href={item.href}>
            {item.label}
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};
