"use client";
import { ThemeSwitch } from "./theme-switch";
import SearchInput from "./Search";
import Image from "next/image";
import { LinkBprogress } from "./link-Bprogress";

interface NavbarProps {
  children?: React.ReactNode;
}

export default function Navbar({ children }: NavbarProps) {
  return (
    <>
      <nav className="mb-4 sticky top-0 z-50 w-full backdrop-blur-md dark:border-slate-700 border-b shadow-md">
        <div className="container flex h-16 items-center gap-3 bg-background/50 dark:bg-background/50 justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-auto">
              <LinkBprogress href="/">
                <Image
                  src="/favicon.ico"
                  alt="Logo"
                  width={32}
                  height={32}
                  className="h-full w-auto object-contain"
                />
              </LinkBprogress>
            </div>
            <span className="hidden text-lg font-semibold md:inline-block">
              VNDL
            </span>
          </div>
          {children}
          <div className="flex-1 max-w-md md:block">
            <div className="relative">
              <SearchInput />
            </div>
          </div>
          <ThemeSwitch />
        </div>
      </nav>
    </>
  );
}
