import { Link } from '@tanstack/react-router'
import { Image } from '@unpic/react'
import { Button } from '@web/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
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
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import UserMenu from './user/UserMenu'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="mx-auto w-full max-w-7xl border-b bg-background px-4 py-2 lg:my-4 rounded-full lg:border dark:opacity-70">
      <div className="flex items-center justify-between">
        {/* Left block */}
        <div className="flex items-center">
          <Link to="/" className="flex items-center">
            <Image src="/favicon.ico" width={32} height={32} />
          </Link>
          <div>
            <NavigationMenu>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    render={<Link to="/" />}
                  >
                    主页
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    render={<Link to="/tags" />}
                  >
                    标签
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    render={<Link to="/tools" />}
                  >
                    工具
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    render={<Link to="/contact" />}
                  >
                    联系
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>

        {/* Right block */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" />}>
                <Menu className="size-5" />
                <span className="sr-only">打开菜单</span>
              </SheetTrigger>
              <SheetContent side="right" className="w-75 sm:w-100">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Image src="/favicon.ico" width={24} height={24} />
                    菜单
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                  <Link
                    to="/"
                    className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsOpen(false)}
                  >
                    主页
                  </Link>
                  <Link
                    to="/tags"
                    className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsOpen(false)}
                  >
                    标签
                  </Link>
                  <Link
                    to="/tools"
                    className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsOpen(false)}
                  >
                    工具
                  </Link>
                  <Link
                    to="/contact"
                    className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsOpen(false)}
                  >
                    联系
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <UserMenu />
        </div>
      </div>
    </div>
  )
}
