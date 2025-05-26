"use client";
import { Link } from "next-view-transitions";
import Image from "next/image";
import { Suspense } from "react";

import SearchInput from "@/components/Search";
import { ThemeSwitch } from "@/components/theme-switch";
import { Account } from "@/components/account";

export function Navbar() {
  return (
    <>
      {/* Placeholder div with the same height as navbar */}
      <div className="mx-auto w-full max-w-6xl border-b bg-background px-4 py-2 lg:my-4 lg:rounded-full lg:border">
        <div className="flex items-center justify-between">
          {/* Left block */}
          <div className="flex-none">
            <Link href="/" className="flex items-center">
              <Image src="/favicon.ico" alt="logo" width={32} height={32} />
            </Link>
          </div>

          {/* Center block */}
          <div className="flex-1 mx-4 max-w-md">
            <Suspense fallback={<div>加载中...</div>}>
              <SearchInput />
            </Suspense>
          </div>

          {/* Right block */}
          <div className="flex items-center gap-2">
            <ThemeSwitch />
            <Account />
          </div>
        </div>
      </div>
    </>
  );
}
