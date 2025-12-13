'use client'

import { cn } from '@shadcn/ui/lib/utils'
import { motion, type Transition } from 'motion/react'
import { Progress as ProgressPrimitive } from 'radix-ui'
import type * as React from 'react'

const MotionProgressIndicator = motion.create(ProgressPrimitive.Indicator)

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  transition?: Transition
}

function Progress({
  className,
  value,
  transition = { type: 'spring', stiffness: 100, damping: 30 },
  ...props
}: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-secondary',
        className,
      )}
      value={value}
      {...props}
    >
      <MotionProgressIndicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary rounded-full"
        animate={{ translateX: `-${100 - (value || 0)}%` }}
        transition={transition}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress, type ProgressProps }
