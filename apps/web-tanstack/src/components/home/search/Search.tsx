import { useNavigate } from '@tanstack/react-router'
import { CalendarIcon } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'

// SSR-safe: 服务端无 window 对象
function getSearchParam(key: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(key) ?? ''
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@web/components/ui/alert-dialog'
import { Badge } from '@web/components/ui/badge'
import { Input } from '@web/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@web/components/ui/input-group'

interface SearchInputProps {
  placeholder?: string
}

export default function SearchInput({
  placeholder = '标题、标签、回车，喵喵喵～🐾',
}: SearchInputProps) {
  const navigate = useNavigate()

  const [inputValue, setInputValue] = useState(() => getSearchParam('q'))
  const [startDate, setStartDate] = useState(() => getSearchParam('startDate'))
  const [endDate, setEndDate] = useState(() => getSearchParam('endDate'))
  const [open, setOpen] = useState(false)

  const handleSearch = () => {
    const trimmed = inputValue.trim()

    const params =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams()

    const isSame =
      trimmed === params.get('q') &&
      startDate === (params.get('startDate') ?? '') &&
      endDate === (params.get('endDate') ?? '')

    if (isSame) return

    navigate({
      to: '/search',
      search: {
        q: trimmed,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
      replace: true,
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <InputGroup className="border-2 rounded-lg mb-0">
          <InputGroupAddon align="inline-start">
            <InputGroupButton
              variant="secondary"
              size="icon-xs"
              onClick={() => setOpen(true)}
            >
              <CalendarIcon className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
          <InputGroupInput
            className="border-2 rounded-lg"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton variant="secondary" onClick={handleSearch}>
              搜索
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
      {(startDate || endDate) && (
        <div className="flex items-center gap-2 mt-2">
          <Badge
            className="m-0"
            variant="outline"
          >{`${startDate} - ${endDate}`}</Badge>
        </div>
      )}

      {/* 筛选模态框 */}
      <AlertDialog open={open} onOpenChange={() => setOpen((open) => !open)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>请选择要检索的时间范围</AlertDialogTitle>
            <AlertDialogDescription>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  open ? 'max-h-40 opacity-100 mt-0' : 'max-h-0 opacity-0'
                }`}
              >
                <div
                  className="grid grid-cols-2 gap-2 p-2"
                  role="presentation"
                  onMouseDown={(e) => e.preventDefault()} // 防止 input blur 导致关闭
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      开始日期
                    </span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      结束日期
                    </span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>关闭</AlertDialogCancel>
            <AlertDialogAction onClick={handleSearch}>搜索</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
