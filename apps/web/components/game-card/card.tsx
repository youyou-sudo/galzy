import { AspectRatio } from '@shadcn/ui/components/aspect-ratio'
import { Skeleton } from '@shadcn/ui/components/skeleton'
import NextImage, { type ImageProps } from 'next/image'
import { forwardRef } from 'react'

const IdGameCardSkeleton = forwardRef<HTMLDivElement>(function GameSkeleton() {
  return (
    <>
      <div className="flex space-x-4 mt-10">
        <Skeleton className="h-[200px] w-[270px] w-min-[270px]" />
        <div className="space-y-4 w-full">
          <Skeleton className="h-10 max-w-[200px]" />
          <Skeleton className="h-4 max-w-[200px]" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-4 w-full" key={index} />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex space-x-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-7 w-[50px]" key={index} />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-4 w-3/5" key={index} />
        ))}
      </div>
    </>
  )
})

const GameSkeleton = forwardRef<HTMLDivElement>(function GameSkeleton(_, ref) {
  return (
    <div className="space-y-2 aspect-2/3 p-0" ref={ref}>
      <Skeleton className="h-full w-full inset-0 rounded-lg border bg-muted shadow" />
      <Skeleton className="flex p-2 w-full shadow" />
    </div>
  )
})

export function Image(props: ImageProps) {
  return (
    <AspectRatio
      ratio={9 / 12}
      className="relative w-full h-full overflow-hidden rounded-lg border bg-muted shadow"
    >
      <NextImage
        {...props}
        className={`absolute inset-0 object-cover w-full h-full ${
          props.className || ''
        }`}
        style={{
          width: '100% !important',
          height: '100% !important',
          position: 'absolute',
          inset: 0,
          objectFit: 'cover',
        }}
      />
    </AspectRatio>
  )
}

export const GameCard = {
  ListSkeleton: GameSkeleton,
  Image,
  IdGameCardSkeleton,
}
