'use client'

import { Badge } from '@web/components/ui/badge'
import { Button } from '@web/components/ui/button'
import { Input } from '@web/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@web/components/ui/popover'
import { ScrollArea } from '@web/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@web/components/ui/tabs'
import {
  Activity,
  Clock,
  Flag,
  Lightbulb,
  MapPin,
  Search,
  Smile,
  Users,
} from 'lucide-react'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'

const kaomojis = [
  // 笑脸表情
  {
    text: '(◕‿◕)',
    name: '开心',
    category: '笑脸表情',
  },
  {
    text: '(◠‿◠)',
    name: '微笑',
    category: '笑脸表情',
  },
  {
    text: '(＾▽＾)',
    name: '愉快',
    category: '笑脸表情',
  },
  {
    text: '(´▽`)',
    name: '满足',
    category: '笑脸表情',
  },
  {
    text: '(⌒‿⌒)',
    name: '喜悦',
    category: '笑脸表情',
  },
  {
    text: '(￣▽￣)',
    name: '得意',
    category: '笑脸表情',
  },
  {
    text: '(・∀・)',
    name: '随和',
    category: '笑脸表情',
  },
  {
    text: '(´∀`)',
    name: '放松',
    category: '笑脸表情',
  },
  {
    text: '(◡‿◡)',
    name: '温柔',
    category: '笑脸表情',
  },
  {
    text: '(＾ω＾)',
    name: '开心',
    category: '笑脸表情',
  },
  {
    text: '(≧▽≦)',
    name: '超开心',
    category: '笑脸表情',
  },
  {
    text: '(▰˘◡˘▰)',
    name: '幸福',
    category: '笑脸表情',
  },
  {
    text: '(´｡• ᵕ •｡`)',
    name: '可爱',
    category: '笑脸表情',
  },
  {
    text: '(๑•́ ω •̀๑)',
    name: '撒娇',
    category: '笑脸表情',
  },
  {
    text: '(｡♡‿♡｡)',
    name: '爱心眼',
    category: '笑脸表情',
  },
  {
    text: '(´▽`ʃ♡ƪ)',
    name: '爱心',
    category: '笑脸表情',
  },

  // 悲伤与哭泣
  {
    text: '(´；ω；`)',
    name: '哭泣',
    category: '悲伤与哭泣',
  },
  {
    text: '(´；д；`)',
    name: '大哭',
    category: '悲伤与哭泣',
  },
  {
    text: '(；′⌒`)',
    name: '失落',
    category: '悲伤与哭泣',
  },
  {
    text: '(′∵`)',
    name: '委屈',
    category: '悲伤与哭泣',
  },
  {
    text: '(′︿`)',
    name: '伤心',
    category: '悲伤与哭泣',
  },
  {
    text: '(；´Д`)',
    name: '痛苦',
    category: '悲伤与哭泣',
  },
  {
    text: '(╥﹏╥)',
    name: '泪眼',
    category: '悲伤与哭泣',
  },
  {
    text: '(╥_╥)',
    name: '哭泣',
    category: '悲伤与哭泣',
  },
  {
    text: '(T_T)',
    name: '哭',
    category: '悲伤与哭泣',
  },
  {
    text: '(ㄒoㄒ)',
    name: '泪流满面',
    category: '悲伤与哭泣',
  },
  {
    text: '(；′Д`)',
    name: '悲伤',
    category: '悲伤与哭泣',
  },
  {
    text: '(ノ﹏ヽ)',
    name: '呜咽',
    category: '悲伤与哭泣',
  },
  {
    text: '(；_；)',
    name: '流泪',
    category: '悲伤与哭泣',
  },
  {
    text: '(｡•́︿•̀｡)',
    name: '可怜',
    category: '悲伤与哭泣',
  },
  {
    text: '( ; _ ; )',
    name: '哭哭',
    category: '悲伤与哭泣',
  },

  // 愤怒与不满
  {
    text: '(＃`Д´)',
    name: '愤怒',
    category: '愤怒与不满',
  },
  {
    text: '(｀へ´)',
    name: '生气',
    category: '愤怒与不满',
  },
  {
    text: '(￣^￣)',
    name: '不满',
    category: '愤怒与不满',
  },
  {
    text: '(◣_◢)',
    name: '斗志',
    category: '愤怒与不满',
  },
  {
    text: '(｀皿´)',
    name: '恼怒',
    category: '愤怒与不满',
  },
  {
    text: '(▼皿▼)',
    name: '憎恶',
    category: '愤怒与不满',
  },
  {
    text: '(ﾟ皿ﾟ)',
    name: '暴躁',
    category: '愤怒与不满',
  },
  {
    text: '(≧皿≦)',
    name: '气炸',
    category: '愤怒与不满',
  },
  {
    text: '(｀ε´)',
    name: '不高兴',
    category: '愤怒与不满',
  },
  {
    text: '( ▼へ▼)',
    name: '不爽',
    category: '愤怒与不满',
  },
  {
    text: '(#｀皿´)',
    name: '火大',
    category: '愤怒与不满',
  },
  {
    text: '(｀曲´)',
    name: '生气',
    category: '愤怒与不满',
  },
  {
    text: '(｀´）',
    name: '怒',
    category: '愤怒与不满',
  },

  // 尴尬与害羞
  {
    text: '(⁄ ⁄•⁄ω⁄•⁄ ⁄)',
    name: '害羞',
    category: '尴尬与害羞',
  },
  {
    text: '(〃∀〃)',
    name: '脸红',
    category: '尴尬与害羞',
  },
  {
    text: '(ノ_<。)',
    name: '不好意思',
    category: '尴尬与害羞',
  },
  {
    text: '(；一_一)',
    name: '尴尬',
    category: '尴尬与害羞',
  },
  {
    text: '(；￣д￣)',
    name: '无奈',
    category: '尴尬与害羞',
  },
  {
    text: '(⌒_⌒;)',
    name: '尬笑',
    category: '尴尬与害羞',
  },
  {
    text: '(；^ω^)',
    name: '苦笑',
    category: '尴尬与害羞',
  },
  {
    text: '(^_^;)',
    name: '汗',
    category: '尴尬与害羞',
  },
  {
    text: '(；´∀`)',
    name: '不知所措',
    category: '尴尬与害羞',
  },
  {
    text: '(′-ι_-｀)',
    name: '无语',
    category: '尴尬与害羞',
  },
  {
    text: '(¬_¬)',
    name: '斜眼',
    category: '尴尬与害羞',
  },
  {
    text: '(；¬＿¬)',
    name: '怀疑',
    category: '尴尬与害羞',
  },
  {
    text: '(￣_￣|||)',
    name: '尴尬',
    category: '尴尬与害羞',
  },

  // 惊讶与震惊
  {
    text: '(ﾟдﾟ)',
    name: '惊讶',
    category: '惊讶与震惊',
  },
  {
    text: '(゜ロ゜)',
    name: '震惊',
    category: '惊讶与震惊',
  },
  {
    text: '(⊙_⊙)',
    name: '目瞪口呆',
    category: '惊讶与震惊',
  },
  {
    text: '(○Д○)',
    name: '吓到',
    category: '惊讶与震惊',
  },
  {
    text: '(￣□￣;)',
    name: '惊吓',
    category: '惊讶与震惊',
  },
  {
    text: '(꒪ꇴ꒪)',
    name: '意外',
    category: '惊讶与震惊',
  },
  {
    text: '(ﾟ⊿ﾟ)',
    name: '想不到',
    category: '惊讶与震惊',
  },
  {
    text: '(⊙ˍ⊙)',
    name: '震惊',
    category: '惊讶与震惊',
  },
  {
    text: '(；ﾟДﾟ)',
    name: '吓一跳',
    category: '惊讶与震惊',
  },
  {
    text: '(ʘдʘ)',
    name: '惊呆',
    category: '惊讶与震惊',
  },
  {
    text: '(・o・)',
    name: '茫然',
    category: '惊讶与震惊',
  },
  {
    text: '(°ロ°)',
    name: '震惊',
    category: '惊讶与震惊',
  },
  {
    text: '(⊙ω⊙)',
    name: '好奇',
    category: '惊讶与震惊',
  },
  {
    text: '(°ー°〃)',
    name: '发呆',
    category: '惊讶与震惊',
  },

  // 动作与问候
  {
    text: '(￣▽￣)ノ',
    name: '挥手',
    category: '动作与问候',
  },
  {
    text: '(づ｡◕‿‿◕｡)づ',
    name: '拥抱',
    category: '动作与问候',
  },
  {
    text: '(ノ^_^)ノ',
    name: '欢呼',
    category: '动作与问候',
  },
  {
    text: '┌(・。・)┘',
    name: '耸肩',
    category: '动作与问候',
  },
  {
    text: '(*＾▽＾)／',
    name: '你好',
    category: '动作与问候',
  },
  {
    text: '(￣人￣)',
    name: '抱歉',
    category: '动作与问候',
  },
  {
    text: '(￣▽￣)ゞ',
    name: '敬礼',
    category: '动作与问候',
  },
  {
    text: '(｀・ω・´)',
    name: '握拳',
    category: '动作与问候',
  },
  {
    text: '(๑•̀ㅂ•́)و✧',
    name: '加油',
    category: '动作与问候',
  },
  {
    text: '(v´▽`v)',
    name: '胜利',
    category: '动作与问候',
  },
  {
    text: 'ヽ(´▽`)/',
    name: '欢呼',
    category: '动作与问候',
  },
  {
    text: 'ヾ(＾∇＾)',
    name: '再见',
    category: '动作与问候',
  },
  {
    text: '(^_^)ノ',
    name: '拜拜',
    category: '动作与问候',
  },
  {
    text: '(＿ ＿)ノ｜',
    name: '鞠躬',
    category: '动作与问候',
  },
  {
    text: 'ヽ(￣▽￣)ノ',
    name: '跳舞',
    category: '动作与问候',
  },

  // 动物与自然
  {
    text: '(=^・^=)',
    name: '猫咪',
    category: '动物与自然',
  },
  {
    text: '(^・ω・^)',
    name: '小猫',
    category: '动物与自然',
  },
  {
    text: '(´･ω･`)',
    name: '猫咪',
    category: '动物与自然',
  },
  {
    text: 'U・x・U',
    name: '狗狗',
    category: '动物与自然',
  },
  {
    text: '(U・ω・U)',
    name: '柴犬',
    category: '动物与自然',
  },
  {
    text: '(^._.^)ﾉ',
    name: '小猫咪',
    category: '动物与自然',
  },
  {
    text: '(^・ᴗ・^)',
    name: '兔子',
    category: '动物与自然',
  },
  {
    text: '(^._.^)',
    name: '小动物',
    category: '动物与自然',
  },
  {
    text: '(´・ω・`)',
    name: '松鼠',
    category: '动物与自然',
  },
  {
    text: '(｀・з・´)',
    name: '小鸟',
    category: '动物与自然',
  },
  {
    text: '／(^ x ^)＼',
    name: '仓鼠',
    category: '动物与自然',
  },
  {
    text: '(｀・ω・´)',
    name: '狐狸',
    category: '动物与自然',
  },
  {
    text: '〜(^・ω・^)〜',
    name: '水獭',
    category: '动物与自然',
  },

  // 食物与饮品
  {
    text: '(っ˘ڡ˘ς)',
    name: '好吃',
    category: '食物与饮品',
  },
  {
    text: '(´～`)',
    name: '嚼嚼',
    category: '食物与饮品',
  },
  {
    text: '(￣～￣)',
    name: '咀嚼',
    category: '食物与饮品',
  },
  {
    text: '(´ρ`)',
    name: '吃饱',
    category: '食物与饮品',
  },
  {
    text: '(っ´ω`)ﾉ',
    name: '开动',
    category: '食物与饮品',
  },
  {
    text: '( ´ρ｀)',
    name: '饱了',
    category: '食物与饮品',
  },
  {
    text: '(ﾟдﾟ)ﾉ',
    name: '开饭',
    category: '食物与饮品',
  },
  {
    text: '(´-｀*)',
    name: '品尝',
    category: '食物与饮品',
  },
  {
    text: '(〃´皿`)q',
    name: '开吃',
    category: '食物与饮品',
  },
  {
    text: '(￣￢￣)',
    name: '流口水',
    category: '食物与饮品',
  },
  {
    text: '(´﹃`)',
    name: '嘴馋',
    category: '食物与饮品',
  },
  {
    text: '(っ˘ڡ˘ς)',
    name: '美味',
    category: '食物与饮品',
  },
  {
    text: '(o´ω`o)',
    name: '喝茶',
    category: '食物与饮品',
  },

  // 物品与其他
  {
    text: '(´･_･`)',
    name: '思考',
    category: '物品与其他',
  },
  {
    text: '(￣-￣)',
    name: '冷漠',
    category: '物品与其他',
  },
  {
    text: '(¬‿¬)',
    name: '暧昧',
    category: '物品与其他',
  },
  {
    text: '(´-ω-`)',
    name: '犯困',
    category: '物品与其他',
  },
  {
    text: '(╯°□°）╯︵ ┻━┻',
    name: '掀桌',
    category: '物品与其他',
  },
  {
    text: '┬─┬ノ( º _ ºノ)',
    name: '摆好桌子',
    category: '物品与其他',
  },
  {
    text: '♪(´▽｀)',
    name: '听音乐',
    category: '物品与其他',
  },
  {
    text: '(╯‵□′)╯',
    name: '愤怒掀桌',
    category: '物品与其他',
  },
  {
    text: '(￣▽￣)σ',
    name: '指',
    category: '物品与其他',
  },
  {
    text: '(｀・ω・´)',
    name: '认真',
    category: '物品与其他',
  },
  {
    text: "('∇')",
    name: '轻松',
    category: '物品与其他',
  },
  {
    text: '(´ｰ`)y-~~',
    name: '悠闲',
    category: '物品与其他',
  },
  {
    text: '/(.□.)＼',
    name: '崩溃',
    category: '物品与其他',
  },
]

interface KaomojiPickerProps {
  onKaomojiSelect: (kaomoji: string) => void
  trigger?: React.ReactNode
  maxRecentKaomojis?: number
}

const categoryIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  笑脸表情: Smile,
  悲伤与哭泣: Smile,
  愤怒与不满: Activity,
  尴尬与害羞: Smile,
  惊讶与震惊: Lightbulb,
  动作与问候: Users,
  动物与自然: Activity,
  食物与饮品: MapPin,
  物品与其他: Flag,
}

interface KaomojiGridProps {
  kaomojis: typeof kaomojis
  showCategory?: boolean
  selectedIndex: number
  allVisibleKaomojis: typeof kaomojis
  onKaomojiClick: (kaomoji: string) => void
  setSelectedIndex: (index: number) => void
  kaomojiGridRef: React.RefObject<HTMLDivElement | null>
}

const KaomojiGrid = ({
  kaomojis: kaomojiList,
  showCategory = false,
  selectedIndex,
  allVisibleKaomojis,
  onKaomojiClick,
  setSelectedIndex,
  kaomojiGridRef,
}: KaomojiGridProps) => (
  <div className="grid grid-cols-4 gap-1.5 p-2" ref={kaomojiGridRef}>
    {kaomojiList.map((kaomoji, index) => {
      const globalIndex = showCategory
        ? allVisibleKaomojis.findIndex((k) => k.text === kaomoji.text)
        : index

      return (
        <Button
          key={`${kaomoji.text}-${index}`}
          variant="ghost"
          size="sm"
          className={`h-auto min-h-9 px-2 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-accent ${
            selectedIndex === globalIndex ? 'bg-accent ring-2 ring-primary' : ''
          }`}
          onClick={() => onKaomojiClick(kaomoji.text)}
          title={kaomoji.name}
          onMouseEnter={() => setSelectedIndex(globalIndex)}
        >
          <span
            className="text-sm leading-none"
            role="img"
            aria-label={kaomoji.name}
          >
            {kaomoji.text}
          </span>
        </Button>
      )
    })}
  </div>
)

export default function KaomojiPicker({
  onKaomojiSelect,
  trigger,
  maxRecentKaomojis = 24,
}: KaomojiPickerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [recentKaomojis, setRecentKaomojis] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const kaomojiGridRef = useRef<HTMLDivElement>(null)

  // 从 localStorage 加载最近使用的颜文字
  useEffect(() => {
    const stored = localStorage.getItem('recent-kaomojis')
    if (stored) {
      try {
        startTransition(() => {
          setRecentKaomojis(JSON.parse(stored))
        })
      } catch {
        // 忽略 localStorage 中的无效 JSON
      }
    }
  }, [])

  // 获取唯一分类并按顺序排列
  const categories = useMemo(() => {
    const categoryOrder = [
      '笑脸表情',
      '悲伤与哭泣',
      '愤怒与不满',
      '尴尬与害羞',
      '惊讶与震惊',
      '动作与问候',
      '动物与自然',
      '食物与饮品',
      '物品与其他',
    ]

    const availableCategories = Array.from(
      new Set(kaomojis.map((kaomoji) => kaomoji.category)),
    )
    return categoryOrder.filter((cat) => availableCategories.includes(cat))
  }, [])

  // 搜索，支持关键词匹配
  const filteredKaomojis = useMemo(() => {
    if (!searchTerm) return kaomojis

    const searchLower = searchTerm.toLowerCase()
    return kaomojis.filter((kaomoji) => {
      const nameMatch = kaomoji.name.toLowerCase().includes(searchLower)
      const categoryMatch = kaomoji.category.toLowerCase().includes(searchLower)
      const textMatch = kaomoji.text.toLowerCase().includes(searchLower)

      return nameMatch || categoryMatch || textMatch
    })
  }, [searchTerm])

  // 按分类对颜文字进行分组
  const kaomojisByCategory = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        acc[category] = filteredKaomojis.filter(
          (kaomoji) => kaomoji.category === category,
        )
        return acc
      },
      {} as Record<string, typeof kaomojis>,
    )
  }, [categories, filteredKaomojis])

  // 获取所有可见的颜文字，用于键盘导航
  const allVisibleKaomojis = useMemo(() => {
    if (searchTerm) {
      return filteredKaomojis
    }
    return categories.flatMap((category) => kaomojisByCategory[category] || [])
  }, [searchTerm, filteredKaomojis, categories, kaomojisByCategory])

  const handleKaomojiClick = (kaomoji: string) => {
    onKaomojiSelect(kaomoji)

    // 更新最近使用的颜文字
    const newRecent = [
      kaomoji,
      ...recentKaomojis.filter((k) => k !== kaomoji),
    ].slice(0, maxRecentKaomojis)

    setRecentKaomojis(newRecent)
    localStorage.setItem('recent-kaomojis', JSON.stringify(newRecent))

    setIsOpen(false)
    setSearchTerm('')
    setSelectedIndex(-1)
  }

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < allVisibleKaomojis.length - 1 ? prev + 1 : prev,
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'ArrowRight':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < allVisibleKaomojis.length - 1 ? prev + 1 : prev,
        )
        break
      case 'ArrowLeft':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && allVisibleKaomojis[selectedIndex]) {
          handleKaomojiClick(allVisibleKaomojis[selectedIndex].text)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSearchTerm('')
        setSelectedIndex(-1)
        break
    }
  }

  // 弹出框打开时聚焦搜索输入框
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // 搜索变化时重置选择
  useEffect(() => {
    startTransition(() => {
      setSelectedIndex(-1)
    })
  }, [searchTerm])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 bg-transparent p-0"
          >
            <Smile className="h-4 w-4" />
            <span className="sr-only">打开颜文字选择器</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        onKeyDown={handleKeyDown}
      >
        {/* 搜索头部 */}
        <div className="space-y-2 border-b p-3">
          <div className="relative">
            <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="搜索颜文字..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              aria-label="搜索颜文字"
            />
          </div>

          {/* 搜索结果计数 */}
          {searchTerm && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>找到 {filteredKaomojis.length} 个结果</span>
              {filteredKaomojis.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  使用方向键导航，Enter 选择
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* 搜索结果 */}
        {searchTerm ? (
          <ScrollArea className="h-72">
            {filteredKaomojis.length > 0 ? (
              <KaomojiGrid
                kaomojis={filteredKaomojis}
                showCategory
                selectedIndex={selectedIndex}
                allVisibleKaomojis={allVisibleKaomojis}
                onKaomojiClick={handleKaomojiClick}
                setSelectedIndex={setSelectedIndex}
                kaomojiGridRef={kaomojiGridRef}
              />
            ) : (
              <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                <Search className="mb-2 h-8 w-8" />
                <p className="text-sm">未找到颜文字</p>
                <p className="text-xs">请尝试其他搜索词</p>
              </div>
            )}
          </ScrollArea>
        ) : (
          /* 分类标签页 */
          <Tabs
            defaultValue={recentKaomojis.length > 0 ? 'recent' : categories[0]}
            className="w-full"
          >
            <TabsList
              className="grid h-auto w-full p-1"
              style={{
                gridTemplateColumns: `repeat(${recentKaomojis.length > 0 ? Math.min(categories.length + 1, 4) : Math.min(categories.length, 4)}, 1fr)`,
              }}
            >
              {recentKaomojis.length > 0 && (
                <TabsTrigger
                  value="recent"
                  className="flex items-center gap-1 px-2 py-1 text-xs"
                  title="最近使用"
                >
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">最近</span>
                </TabsTrigger>
              )}
              {categories
                .slice(0, recentKaomojis.length > 0 ? 3 : 4)
                .map((category) => {
                  const IconComponent = categoryIcons[category] || Smile
                  return (
                    <TabsTrigger
                      key={category}
                      value={category}
                      className="flex items-center gap-1 px-2 py-1 text-xs"
                      title={category}
                    >
                      <IconComponent className="h-3 w-3" />
                      <span className="hidden sm:inline">
                        {category.slice(0, 2)}
                      </span>
                    </TabsTrigger>
                  )
                })}
            </TabsList>

            {/* 最近使用的颜文字标签页 */}
            {recentKaomojis.length > 0 && (
              <TabsContent value="recent" className="mt-0">
                <ScrollArea className="h-72">
                  <div className="p-2">
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">最近使用</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {recentKaomojis.map((kaomoji, index) => (
                        <Button
                          key={`recent-${kaomoji}-${index}`}
                          variant="ghost"
                          size="sm"
                          className="h-auto min-h-9 px-2 py-1.5 text-xs whitespace-nowrap transition-colors hover:bg-accent"
                          onClick={() => handleKaomojiClick(kaomoji)}
                          title={`最近使用: ${kaomoji}`}
                        >
                          <span className="text-sm leading-none" role="img">
                            {kaomoji}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {/* 分类标签页 */}
            {categories.map((category) => (
              <TabsContent key={category} value={category} className="mt-0">
                <ScrollArea className="h-72">
                  {kaomojisByCategory[category]?.length > 0 ? (
                    <div className="p-2">
                      <div className="mb-2 flex items-center gap-2 px-1">
                        {(() => {
                          const IconComponent = categoryIcons[category] || Smile
                          return (
                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                          )
                        })()}
                        <span className="text-sm font-medium">{category}</span>
                        <Badge variant="outline" className="text-xs">
                          {kaomojisByCategory[category].length}
                        </Badge>
                      </div>
                      <KaomojiGrid
                        kaomojis={kaomojisByCategory[category]}
                        selectedIndex={selectedIndex}
                        allVisibleKaomojis={allVisibleKaomojis}
                        onKaomojiClick={handleKaomojiClick}
                        setSelectedIndex={setSelectedIndex}
                        kaomojiGridRef={kaomojiGridRef}
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                      <p className="text-sm">此分类中没有颜文字</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  )
}
