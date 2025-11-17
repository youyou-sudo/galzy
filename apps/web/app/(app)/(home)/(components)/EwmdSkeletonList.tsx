import { Skeleton } from "@web/components/ui/skeleton";

export const SkeletonList = ({ count = 4 }: { count?: number }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className="h-[21px] w-full my-2.5" />
    ))}
  </>
)
