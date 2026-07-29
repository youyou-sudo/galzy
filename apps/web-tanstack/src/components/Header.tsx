import { Link } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import { Image } from '@unpic/react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@web/components/ui/tooltip'
import { cn } from '@web/lib/utils'
import { r18Actions, r18Store } from '@web/stores/r18Store'
import { ExternalLink, Eye, EyeOff, Menu, Wrench } from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import UserMenu from './user/UserMenu'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const blurEnabled = useSelector(r18Store, (s) => s.blurEnabled)
  return (
    <div className="sticky top-0 z-50 mx-auto w-full max-w-7xl border-b bg-background/95 backdrop-blur-sm px-4 py-2 lg:mb-4 rounded-full lg:border dark:opacity-70">
      <div className="flex items-center justify-between">
        {/* Left block */}
        <div className="flex items-center">
          <Link to="/" className="hidden md:flex items-center">
            <Image src="/favicon.ico" width={32} height={32} />
          </Link>
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
                  <div className="space-y-1">
                    <div className="px-3 py-2 text-sm font-semibold text-muted-foreground tracking-wider uppercase">
                      工具
                    </div>
                    <Link
                      to="/tools"
                      className="flex items-center gap-3 px-3 py-2 text-base font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      <Wrench className="size-4 shrink-0 text-muted-foreground" />
                      所有工具
                    </Link>
                    <Link
                      to="/tools/plate"
                      className="flex items-center gap-3 px-3 py-2 text-base font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                      车牌号跳转
                    </Link>
                  </div>
                  <Link
                    to="/topics"
                    className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                    onClick={() => setIsOpen(false)}
                  >
                    论坛
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
          <div className="hidden md:block">
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
                  <NavigationMenuTrigger>工具</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[220px] gap-1 p-3">
                      <li>
                        <NavigationMenuLink
                          className={cn(
                            navigationMenuTriggerStyle(),
                            'h-auto w-full justify-start gap-3',
                          )}
                          render={<Link to="/tools" />}
                        >
                          <Wrench className="size-4 shrink-0" />
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-sm font-medium">
                              所有工具
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                              查看全部实用工具
                            </span>
                          </div>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink
                          className={cn(
                            navigationMenuTriggerStyle(),
                            'h-auto w-full justify-start gap-3',
                          )}
                          render={<Link to="/tools/plate" />}
                        >
                          <ExternalLink className="size-4 shrink-0" />
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="text-sm font-medium">
                              车牌号跳转
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                              快速跳转到 nhentai、禁漫天堂等网站
                            </span>
                          </div>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    className={navigationMenuTriggerStyle()}
                    render={<Link to="/topics" />}
                  >
                    论坛
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'gap-1 px-1.5 min-w-0',
                    blurEnabled
                      ? 'text-pink-500 hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/20'
                      : 'text-green-500 hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20',
                  )}
                  onClick={r18Actions.toggle}
                >
                  {blurEnabled ? (
                    <EyeOff className="size-4 shrink-0" />
                  ) : (
                    <Eye className="size-4 shrink-0" />
                  )}
                  <span className="text-[10px] font-bold leading-none">
                    涩！
                  </span>
                </Button>
              }
            />
            <TooltipContent>
              {blurEnabled ? '点击关闭涩！模糊' : '点击开启涩！模糊'}
            </TooltipContent>
          </Tooltip>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </div>
  )
}
