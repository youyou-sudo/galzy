"use client";
import { Link } from "next-view-transitions";
import type React from "react";

import Image from "next/image";
import { ThemeSwitch } from "@/components/theme-switch";
import { useState } from "react";
import { Menu, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const components: { title: string; href: string; description: string }[] = [
  {
    title: "莱茵",
    href: "https://t.me/RhineLibrary",
    description: "一个 Telegram Galgame 资源频道",
  },
  {
    title: "莉斯坦 ACG",
    href: "https://www.limulu.moe",
    description: "一个简洁美观人性化的 ACG 资源站",
  },
  {
    title: "鲲 Galgame 论坛",
    href: "https://www.kungal.com",
    description: "世界上最萌的 Galgame 论坛! ",
  },
  {
    title: "Hikarinagi",
    href: "https://www.hikarinagi.org",
    description: "Hikarinagi致力于为所有ACG爱好者提供一个交流和分享的平台! ",
  },
];

const contactlist: { title: string; href: string; description: string }[] = [
  {
    title: "Telegram 群组",
    href: "https://t.me/+mKVpQNjxQss1ZDRl",
    description: "紫缘社的 Telegram 群组",
  },
  {
    title: "Email 邮箱 GalzyAdvertising@proton.me",
    href: "mailto:GalzyAdvertising@proton.me",
    description: "联系我们的 Email 邮箱，接受问题反馈和合作建议",
  },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFriendLinksOpen, setIsFriendLinksOpen] = useState(false);

  return (
    <>
      {/* Placeholder div with the same height as navbar */}
      <div className="mx-auto w-full max-w-7xl border-b bg-background px-4 py-2 lg:my-4 rounded-full lg:border dark:opacity-70">
        <div className="flex items-center justify-between">
          {/* Left block */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image src="/favicon.ico" alt="logo" width={32} height={32} />
            </Link>

            <div className="hidden md:block">
              <NavigationMenu viewport={false}>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href="/">主页</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>友链</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        {components.map((component) => (
                          <ListItem
                            key={component.title}
                            title={component.title}
                            href={component.href}
                          >
                            {component.description}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>联系</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-1 md:w-[200px] lg:w-[300px]">
                        {contactlist.map((component) => (
                          <ListItem
                            key={component.title}
                            title={component.title}
                            href={component.href}
                          >
                            {component.description}
                          </ListItem>
                        ))}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          {/* Right block */}
          <div className="flex items-center gap-2">
            <ThemeSwitch />

            <div className="md:hidden">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">打开菜单</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Image
                        src="/favicon.ico"
                        alt="logo"
                        width={24}
                        height={24}
                      />
                      菜单
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <Link
                      href="/"
                      className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      主页
                    </Link>
                    <div className="space-y-2">
                      <button
                        onClick={() => setIsFriendLinksOpen(!isFriendLinksOpen)}
                        className="flex items-center justify-between w-full px-3 py-2 text-lg font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md"
                      >
                        <span>友链</span>
                        {isFriendLinksOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isFriendLinksOpen
                            ? "max-h-96 opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-1 pt-1">
                          {components.map((component) => (
                            <Link
                              key={component.title}
                              href={component.href}
                              className="block px-6 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md"
                              onClick={() => setIsOpen(false)}
                            >
                              <div className="font-medium">
                                {component.title}
                              </div>
                              {component.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {component.description}
                                </div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            {/* <Account /> */}
          </div>
        </div>
      </div>
    </>
  );
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href} target="_blank">
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}
