'use client'

import {
  Highlight,
  HighlightItem,
  type HighlightItemProps,
  type HighlightProps,
} from '@web/components/animate-ui/primitives/effects/highlight'
import { useControlledState } from '@web/hooks/use-controlled-state'
import { getStrictContext } from '@web/lib/get-strict-context'
import { AnimatePresence, type HTMLMotionProps, motion } from 'motion/react'
import { Tabs as TabsPrimitive } from 'radix-ui'
import type * as React from 'react'

type TabsContextType = {
  value: string | undefined
  setValue: (value: string) => void
}

const [TabsProvider, useTabs] = getStrictContext<TabsContextType>('TabsContext')

type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root>

function Tabs(props: TabsProps) {
  const [value, setValue] = useControlledState({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onValueChange,
  })

  return (
    <TabsProvider value={{ value, setValue }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        {...props}
        onValueChange={setValue}
      />
    </TabsProvider>
  )
}

type TabsHighlightProps = Omit<HighlightProps, 'controlledItems' | 'value'>

function TabsHighlight({
  transition = { type: 'spring', stiffness: 200, damping: 25 },
  ...props
}: TabsHighlightProps) {
  const { value } = useTabs()

  return (
    <Highlight
      data-slot="tabs-highlight"
      controlledItems
      value={value}
      transition={transition}
      click={false}
      {...props}
    />
  )
}

type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List>

function TabsList(props: TabsListProps) {
  return <TabsPrimitive.List data-slot="tabs-list" {...props} />
}

type TabsHighlightItemProps = HighlightItemProps & {
  value: string
}

function TabsHighlightItem(props: TabsHighlightItemProps) {
  return <HighlightItem data-slot="tabs-highlight-item" {...props} />
}

type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger>

function TabsTrigger(props: TabsTriggerProps) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" {...props} />
}

type TabsContentProps = React.ComponentProps<typeof TabsPrimitive.Content> &
  HTMLMotionProps<'div'>

function TabsContent({
  value,
  forceMount,
  transition = { duration: 0.5, ease: 'easeInOut' },
  ...props
}: TabsContentProps) {
  return (
    <AnimatePresence mode="wait">
      <TabsPrimitive.Content asChild forceMount={forceMount} value={value}>
        <motion.div
          data-slot="tabs-content"
          layout
          layoutDependency={value}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={transition}
          {...props}
        />
      </TabsPrimitive.Content>
    </AnimatePresence>
  )
}

type TabsContentsProps = HTMLMotionProps<'div'> & {
  children: React.ReactNode
}

function TabsContents({
  transition = { type: 'spring', stiffness: 200, damping: 30 },
  ...props
}: TabsContentsProps) {
  const { value } = useTabs()

  return (
    <motion.div
      data-slot="tabs-contents"
      layout="size"
      layoutDependency={value}
      style={{ overflow: 'hidden' }}
      transition={{ layout: transition }}
      {...props}
    />
  )
}

export {
  Tabs,
  TabsHighlight,
  TabsHighlightItem,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContents,
  type TabsProps,
  type TabsHighlightProps,
  type TabsHighlightItemProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
  type TabsContentsProps,
}
