'use client'

import {
  Slot,
  type WithAsChild,
} from '@web/components/animate-ui/primitives/animate/slot'
import { useAutoHeight } from '@web/hooks/use-auto-height'
import {
  type HTMLMotionProps,
  type LegacyAnimationControls,
  motion,
  type TargetAndTransition,
  type Transition,
} from 'motion/react'
import type * as React from 'react'

type AutoHeightProps = WithAsChild<
  {
    children: React.ReactNode
    deps?: React.DependencyList
    animate?: TargetAndTransition | LegacyAnimationControls
    transition?: Transition
  } & Omit<HTMLMotionProps<'div'>, 'animate'>
>

function AutoHeight({
  children,
  deps = [],
  transition = {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    bounce: 0,
    restDelta: 0.01,
  },
  style,
  animate,
  asChild = false,
  ...props
}: AutoHeightProps) {
  const { ref, height } = useAutoHeight<HTMLDivElement>(deps)

  const Comp = asChild ? Slot : motion.div

  return (
    <Comp
      style={{ overflow: 'hidden', ...style }}
      animate={{ height, ...animate }}
      transition={transition}
      {...props}
    >
      <div ref={ref}>{children}</div>
    </Comp>
  )
}

export { AutoHeight, type AutoHeightProps }
