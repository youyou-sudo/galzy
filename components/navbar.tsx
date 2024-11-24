"use client";
import {
  Navbar as NextUINavbar,
  NavbarContent,
  NavbarBrand,
} from "@nextui-org/navbar";
import Link from "next/link";
import { usePathname } from "next/navigation";

// import { siteConfig } from "@/config/site";
import Search from "./Search";
import { NavigationCandidates } from "./nav-Linklist";

import { Suspense } from "react";
import { ThemeSwitch } from "@/components/theme-switch";
import { useSession } from "next-auth/react";
import { Image } from "@nextui-org/react";

export const Navbar = () => {
  const routerpath = usePathname();
  const { status } = useSession();
  return (
    <NextUINavbar
      className="shadow-sm radius-md"
      maxWidth="xl"
      position="sticky"
    >
      {routerpath.startsWith("/dashboard") ? (
        <>
          <NavbarBrand>
            <Link className="font-bold text-inherit" href="/">
              {/* {siteConfig.name} */}
              <Image
                alt="LOGO"
                className="hidden sm:flex basis-1/5 sm:basis-full"
                width={60}
                src={"/favicon.ico"}
              />
            </Link>
          </NavbarBrand>
        </>
      ) : (
        <>
          <NavbarBrand>
            <Link className="font-bold text-inherit" href="/">
              {/* {siteConfig.name} */}
              <Image alt="LOGO" width={130} src={"/favicon.ico"} />
            </Link>
            <NavigationCandidates />
          </NavbarBrand>
          <NavbarContent className="flex w-9/12" justify="center">
            <Suspense>
              <Search />
            </Suspense>
          </NavbarContent>
        </>
      )}

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <ThemeSwitch />
        <div>
          {status === "authenticated" && (
            <div>{/* <Avatar isDisabled name={session.user.name} /> */}</div>
          )}
        </div>
      </NavbarContent>
    </NextUINavbar>
  );
};
