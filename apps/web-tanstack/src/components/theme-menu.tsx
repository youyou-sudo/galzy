import {
  Check,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

export type ThemeMode = "light" | "dark" | "auto";

// 懒加载的主题下拉菜单：dropdown-menu 代码只在首次点击时进入客户端
export function ThemeMenu({
  open,
  mode,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  mode: ThemeMode
  onOpenChange: (open: boolean) => void
  onSelect: (mode: ThemeMode) => void
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" className="rounded-full" />
        }
      >
        {mode === "light" ? (
          <Sun className="size-[1.2rem] text-amber-500" />
        ) : mode === "dark" ? (
          <Moon className="size-[1.2rem] text-blue-400" />
        ) : (
          <Monitor className="size-[1.2rem] text-zinc-500" />
        )}
        <span className="sr-only">主题</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-32 rounded-xl">
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onSelect("light")}
        >
          <Sun className="size-4 text-amber-500" />
          <span>浅色</span>
          {mode === "light" && <Check className="size-4 ml-auto" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onSelect("dark")}
        >
          <Moon className="size-4 text-blue-400" />
          <span>深色</span>
          {mode === "dark" && <Check className="size-4 ml-auto" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onSelect("auto")}
        >
          <Monitor className="size-4 text-zinc-500" />
          <span>跟随系统</span>
          {mode === "auto" && <Check className="size-4 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
