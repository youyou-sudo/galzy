"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { mainMenuItems, settingsMenuItems } from "@/config/site";
import type { MenuItem } from "@/types/dataClass";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SidebarProps {
  className?: string;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  className,
  isMobile,
  isOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);

  // 根据当前路径判断是否有子菜单匹配，如果有则自动展开
  useEffect(() => {
    const allMenus = [...mainMenuItems, ...settingsMenuItems];
    const match = allMenus.find(
      (menu) =>
        menu.children && menu.children.some((child) => child.path === pathname)
    );
    setOpenSubmenuId(match ? match.id : null);
  }, [pathname]);

  if (isMobile && !isOpen) return null;

  const isPathActive = (path: string) => {
    if (path === "/") {
      return pathname === path;
    }
    return pathname === path;
  };

  const isMenuItemActive = (item: MenuItem) => {
    if (item.children) {
      return item.children.some((child) => isPathActive(child.path));
    }
    return isPathActive(item.path);
  };

  const handleMenuItemClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleSubmenuToggle = (id: string) => {
    setOpenSubmenuId(openSubmenuId === id ? null : id);
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive = isMenuItemActive(item);

    if (item.children) {
      const isOpen = openSubmenuId === item.id;

      return (
        <Collapsible
          key={item.id}
          open={isOpen}
          onOpenChange={() => handleSubmenuToggle(item.id)}
          className="space-y-1"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start"
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.title}
              <ChevronDown
                className={cn(
                  "ml-auto h-4 w-4 transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 px-4 pt-1">
            {item.children.map((child) => (
              <Link
                key={child.id}
                href={child.path}
                onClick={handleMenuItemClick}
                className="block"
              >
                <Button
                  variant={isPathActive(child.path) ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                >
                  {child.title}
                </Button>
              </Link>
            ))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.path}
        onClick={handleMenuItemClick}
        className="block"
      >
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className="w-full justify-start"
        >
          <item.icon className="mr-2 h-4 w-4" />
          {item.title}
        </Button>
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r bg-background/80 pb-4 pt-16 backdrop-blur-md dark:border-slate-700 dark:bg-background/70",
        isMobile && "animate-in slide-in-from-left duration-300",
        className
      )}
    >
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={onClose}
        >
          <span className="sr-only">关闭侧边栏</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-x"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </Button>
      )}

      <div className="flex-1 overflow-auto px-3">
        <div className="space-y-1 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            仪表盘
          </h2>
          <nav className="space-y-1">{mainMenuItems.map(renderMenuItem)}</nav>
        </div>

        <div className="py-2">
          <h2 className="relative px-4 text-lg font-semibold tracking-tight">
            设置
          </h2>
          <nav className="space-y-1 pt-2">
            {settingsMenuItems.map(renderMenuItem)}
          </nav>
        </div>
      </div>

      <div className="mt-auto border-t px-3 py-2 dark:border-slate-700">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage
                src="/placeholder.svg?height=32&width=32"
                alt="用户头像"
              />
              <AvatarFallback>用户</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">管理员</p>
              <p className="text-xs text-muted-foreground">admin@example.com</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isMobile && onClose) {
                onClose();
              }
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">退出登录</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
