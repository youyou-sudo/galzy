"use client";
import Link from "next/link";
import Image from "next/image";
import SearchInput from "./Search";
import { ThemeSwitch } from "./theme-switch";
import { Account } from "./account";
import { Suspense } from "react";

export function Navbar() {
  return (
    <>
      {/* Placeholder div with the same height as navbar */}
      <div className="h-[88px]" /> {/* 88px = py-4(32px) + h-14(56px) */}
      <div className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
        <div className="w-full flex justify-center py-2 mx-auto max-w-6xl">
          <div className="flex h-14 items-center px-6 rounded-full shadow-sm bg-background/50 backdrop-blur-md w-full">
            {/* Left block */}
            <div className="flex-none">
              <Link href="/" className="flex items-center">
                <Image src="/favicon.ico" alt="logo" width={32} height={32} />
              </Link>
            </div>

            {/* Center block - always centered */}
            <div className="flex-1 flex justify-center">
              <div className="w-full max-w-md">
                <Suspense fallback={<div>加载中...</div>}>
                  <SearchInput />
                </Suspense>
              </div>
            </div>

            {/* Right block */}
            <div className="flex-none flex items-center gap-2">
              <ThemeSwitch />
              <Account />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
