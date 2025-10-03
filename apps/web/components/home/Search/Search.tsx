'use client'

import { useRouter } from '@bprogress/next/app'
import { Button } from '@web/components/ui/button'
import { Card } from '@web/components/ui/card'
import { Input } from '@web/components/ui/input'
import { LoaderCircleIcon, Search, SearchIcon } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import type React from 'react'
import { useEffect, useState } from 'react'

interface SearchInputProps {
  placeholder?: string
}

export default function SearchInput({
  placeholder = '标题、标签、回车 Go!🐾',
}: SearchInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [inputValue, setInputValue] = useState('')

  // 初始挂载读取路由参数
  useEffect(() => {
    const q = searchParams.get('q') || ''
    setInputValue(q)
  }, [searchParams])

  const handleSearch = () => {
    const trimmed = inputValue.trim()
    if (!trimmed) return

    const params = new URLSearchParams()
    params.set('q', trimmed)

    router.push(`/search?${params.toString()}`)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <Card className="p-0 border-0 shadow-none w-full">
      <div className="relative">
        <Input
          className="peer ps-9 pe-9"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
        />
        <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
          <SearchIcon size={16} aria-hidden="true" />
        </div>
        <Button
          onClick={handleSearch}
          variant="ghost"
          disabled={!inputValue.trim()}
          size="sm"
          className="text-muted-foreground/80 mr-2 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Press to speak"
          type="submit"
        >
          搜索
        </Button>
      </div>
    </Card>
  )
}
