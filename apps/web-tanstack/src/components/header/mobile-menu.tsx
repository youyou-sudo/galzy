import { Link } from '@tanstack/react-router'
import { Image } from '@unpic/react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@web/components/ui/sheet'
import { ExternalLink, Wrench } from 'lucide-react'

// 移动端导航菜单。整体懒加载：dialog/scroll-lock 代码只在首次打开时进入客户端 bundle
export function HeaderMobileMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onOpenChange(false)}
          >
            主页
          </Link>
          <Link
            to="/tags"
            className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
            onClick={() => onOpenChange(false)}
          >
            标签
          </Link>
          <Link
            to="/producer"
            className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
            onClick={() => onOpenChange(false)}
          >
            会社
          </Link>
          <div className="space-y-1">
            <div className="px-3 py-2 text-sm font-semibold text-muted-foreground tracking-wider uppercase">
              工具
            </div>
            <Link
              to="/tools"
              className="flex items-center gap-3 px-3 py-2 text-base font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
              onClick={() => onOpenChange(false)}
            >
              <Wrench className="size-4 shrink-0 text-muted-foreground" />
              所有工具
            </Link>
            <Link
              to="/tools/plate"
              className="flex items-center gap-3 px-3 py-2 text-base font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
              onClick={() => onOpenChange(false)}
            >
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              车牌号跳转
            </Link>
          </div>
          <Link
            to="/topics"
            className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
            onClick={() => onOpenChange(false)}
          >
            论坛
          </Link>
          <Link
            to="/contact"
            className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
            onClick={() => onOpenChange(false)}
          >
            联系
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
