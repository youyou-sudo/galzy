'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@web/components/animate-ui/components/radix/dropdown-menu'
import { Button } from '@web/components/ui/button'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

export function ThemeSwitch() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null // SSR 阶段不渲染，避免 hydration mismatch

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full">
          {theme === 'light' ? (
            <Sun className="h-[1.2rem] w-[1.2rem] text-amber-500" />
          ) : theme === 'dark' ? (
            <Moon className="h-[1.2rem] w-[1.2rem] text-blue-400" />
          ) : (
            <Monitor className="h-[1.2rem] w-[1.2rem] text-gray-500" />
          )}
          <span className="sr-only">主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem] rounded-xl">
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setTheme('light')}
        >
          <Sun className="h-4 w-4 text-amber-500" />
          <span>浅色</span>
          {theme === 'light' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setTheme('dark')}
        >
          <Moon className="h-4 w-4 text-blue-400" />
          <span>深色</span>
          {theme === 'dark' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setTheme('system')}
        >
          <Monitor className="h-4 w-4 text-gray-500" />
          <span>系统</span>
          {theme === 'system' && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
