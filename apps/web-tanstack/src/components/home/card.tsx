import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { Image, type ImageProps } from "@unpic/react";
import { forwardRef } from "react";

const IdGameCardSkeleton = forwardRef<HTMLDivElement>(function GameSkeleton() {
  return (
    <>
      <div className="flex space-x-4 mt-10">
        <Skeleton className="h-50 w-67.5 w-min-[270px]" />
        <div className="space-y-4 w-full">
          <Skeleton className="h-10 max-w-50" />
          <Skeleton className="h-4 max-w-50" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-4 w-full" key={index} />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex space-x-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-7 w-12.5" key={index} />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-4 w-3/5" key={index} />
        ))}
      </div>
    </>
  );
});

const GameSkeleton = forwardRef<HTMLDivElement>(function GameSkeleton(_, ref) {
  return (
    <div className="space-y-2 aspect-2/3 p-0" ref={ref}>
      <Skeleton className="h-full w-full inset-0 rounded-lg border bg-muted shadow" />
      <Skeleton className="flex p-2 w-full shadow" />
    </div>
  );
});

export function Images({ className, ...props }: ImageProps) {
  return (
    <AspectRatio
      ratio={9 / 12}
      className="w-full overflow-hidden rounded-lg border bg-muted shadow"
    >
      <Image
        {...props}
        className={`w-full h-full object-cover ${className ?? ""}`}
      />
    </AspectRatio>
  );
}

export const GameCard = {
  ListSkeleton: GameSkeleton,
  Image,
  IdGameCardSkeleton,
};
