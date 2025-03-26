"use client";
import { type ButtonProps } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "@bprogress/next/app";

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<typeof Link>;
export function LinkBprogress({ ...props }: PaginationLinkProps) {
  const router = useRouter();
  return (
    <Link
      onClick={(e) => {
        e.preventDefault();
        router.push(props.href as string);
      }}
      {...props}
    />
  );
}
