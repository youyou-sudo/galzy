"use client";
import {
  Navbar as NextUINavbar,
  NavbarContent,
  NavbarBrand,
} from "@heroui/navbar";
import Link from "next/link";

// import { siteConfig } from "@/config/site";
import Search from "./Search";
import { NavigationCandidates } from "./nav-Linklist";

import { Suspense } from "react";
import { ThemeSwitch } from "@/components/theme-switch";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Avatar } from "@heroui/react";
export const Navbar = () => {
  const { status, data: session } = useSession();
  return (
    <NextUINavbar
      className="shadow-sm radius-md"
      maxWidth="xl"
      position="sticky"
    >
      <NavbarBrand>
        <Link className="font-bold text-inherit" href="/">
          <Image alt="VNDL 首页" width={60} height={60} src={"/favicon.ico"} />
        </Link>
        <NavigationCandidates />
      </NavbarBrand>
      <NavbarContent className="flex w-9/12" justify="center">
        <Suspense>
          <Search />
        </Suspense>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <ThemeSwitch />
        <div>
          {status === "authenticated" && (
            <div>
              <Avatar isDisabled name={session.user?.name ?? ""} />
            </div>
          )}
        </div>
      </NavbarContent>
    </NextUINavbar>
  );
};
