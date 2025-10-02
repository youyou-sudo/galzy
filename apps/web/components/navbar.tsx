'use client'
import { ThemeSwitch } from '@web/components/theme-switch'
import { Button } from '@web/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@web/components/ui/navigation-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@web/components/ui/sheet'
import { Menu } from 'lucide-react'
import Image from 'next/image'
import { Link } from 'next-view-transitions'
import type React from 'react'
import { useState } from 'react'

const contactlist: { title: string; href: string; description: string }[] = [
  {
    title: 'Telegram 群组',
    href: 'https://t.me/ziyuanlinyin',
    description: '紫缘社的 Telegram 群组',
  },
  {
    title: 'Email 邮箱 GalzyAdvertising@proton.me',
    href: 'mailto:GalzyAdvertising@proton.me',
    description: '联系我们的 Email 邮箱，接受问题反馈和合作赞助',
  },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

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
                  </div>
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

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<'li'> & { href: string }) {
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
  )
}
