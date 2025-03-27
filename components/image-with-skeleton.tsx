"use client";

import { useState } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

interface ImageWithSkeletonProps extends React.ComponentProps<typeof Image> {
  className?: string;
}

/**
 * A React component that displays an image with a skeleton loading state.
 *
 * @component
 * @param {object} props - The component props
 * @param {string} props.src - The source URL of the image
 * @param {string} props.alt - The alternative text for the image
 * @param {number} props.width - The width of the image and skeleton
 * @param {number} props.height - The height of the image and skeleton
 * @param {string} [props.className=""] - Optional CSS class name for additional styling
 * @returns {JSX.Element} A div containing both the skeleton loader and the image
 *
 * @example
 * ```tsx
 * <ImageWithSkeleton
 *   src="/example.jpg"
 *   alt="Example"
 *   width={300}
 *   height={200}
 *   className="custom-class"
 * />
 * ```
 */
export function ImageWithSkeleton({
  src,
  alt,
  width,
  height,
  className = "",
  ...props
}: ImageWithSkeletonProps) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="relative">
      {isLoading && (
        <Skeleton
          className="absolute inset-0 rounded-lg"
          style={{ width, height }}
        />
      )}
      <Image
        src={src || "/placeholder.svg"}
        alt={alt}
        width={width}
        height={height}
        className={`rounded-lg ${className}`}
        onLoad={() => setIsLoading(false)}
        {...props}
      />
    </div>
  );
}
