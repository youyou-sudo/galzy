import { forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import NextImage, { type ImageProps } from "next/image";

const GameSkeleton = forwardRef<HTMLDivElement>(function GameSkeleton(_, ref) {
  return (
    <div className="space-y-2 aspect-[2/3] p-0">
      <Skeleton
        ref={ref}
        className="h-full w-full inset-0 rounded-lg border bg-muted shadow"
      />

      <Skeleton ref={ref} className="flex p-2 w-full shadow" />
    </div>
  );
});

export function Image(props: ImageProps) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg border bg-muted shadow">
      <NextImage {...props} className="absolute inset-0 z-10 object-cover" />
    </div>
  );
}

export const GameCard = {
  ListSkeleton: GameSkeleton,
  Image,
};
