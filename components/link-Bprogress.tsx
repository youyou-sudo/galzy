"use client";
import Link, { type LinkProps } from "next/link";
import { useRouter } from "@bprogress/next/app";

export function LinkBprogress({ ...props }: LinkProps) {
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
