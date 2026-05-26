import { AspectRatio } from "@web/components/ui/aspect-ratio";
import { Skeleton } from "@web/components/ui/skeleton";
import { Image, type ImageProps } from "@unpic/react";
import type { ComponentProps } from "react";

function IdGameCardSkeleton({ ref, ...props }: ComponentProps<"div">) {
	return (
		<div ref={ref} {...props}>
			<div className="flex gap-4 mt-10">
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
				<div className="flex gap-2">
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton className="h-7 w-12.5" key={index} />
					))}
				</div>
				{Array.from({ length: 3 }).map((_, index) => (
					<Skeleton className="h-4 w-3/5" key={index} />
				))}
			</div>
		</div>
	);
}

function GameSkeleton({ ref, ...props }: ComponentProps<"div">) {
	return (
		<div className="space-y-2 aspect-2/3 p-0" ref={ref} {...props}>
			<Skeleton className="h-full w-full inset-0 rounded-lg border bg-muted shadow" />
			<Skeleton className="flex p-2 w-full shadow" />
		</div>
	);
}

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
