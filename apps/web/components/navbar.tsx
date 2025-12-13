'use client'
import { Button } from '@shadcn/ui/components/button'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@shadcn/ui/components/navigation-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@shadcn/ui/components/sheet'
import { ThemeSwitch } from '@web/components/theme-switch'
import { Menu } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import ForesightLink from './HoverPLink'

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Placeholder div with the same height as navbar */}
      <div className="mx-auto w-full max-w-7xl border-b bg-background px-4 py-2 lg:my-4 rounded-full lg:border dark:opacity-70">
        <div className="flex items-center justify-between">
          {/* Left block */}
          <div className="flex items-center">
            <ForesightLink href="/" className="flex items-center">
              <Image src="/favicon.ico" alt="logo" width={32} height={32} />
            </ForesightLink>

            <div className="hidden md:block">
              <NavigationMenu viewport={false}>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <ForesightLink href="/">主页</ForesightLink>
                    </NavigationMenuLink>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <ForesightLink href="contact">联系</ForesightLink>
                    </NavigationMenuLink>
                  </NavigationMenuItem>

                  {/* <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href="/openapi">OpenApi</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem> */}

                  {/* <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link
                        target="_blank"
                        data-umami-event="广告点击"
                        data-umami-event-name="DZMM"
                        data-umami-event-position="导航广告-DZMM"
                        href="https://www.xn--i8s951di30azba.com?rf=876926e5"
                      >
                        Ai女友💋（在线畅玩）
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem> */}
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
                  <div className="space-y-4">
                    <ForesightLink
                      href="/"
                      className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      主页
                    </ForesightLink>
                  </div>
                  <div className="space-y-4">
                    <ForesightLink
                      href="contact"
                      className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      联系
                    </ForesightLink>
                  </div>
                  {/* <div className="space-y-4">
                    <Link
                      target="_blank"
                      data-umami-event="广告点击"
                      data-umami-event-name="DZMM"
                      data-umami-event-position="导航广告-DZMM"
                      href="https://www.xn--i8s951di30azba.com?rf=876926e5"
                      className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      Ai女友💋（在线畅玩）
                    </Link>
                  </div> */}
                </SheetContent>
              </Sheet>
            </div>
            {/* <Account /> */}
          </div>
        </div>
      </div>
    </>
  )
}
