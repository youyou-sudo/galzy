"use client";

import { Image } from "@nextui-org/react";

interface ErrorsProps {
  code: string;
}

/**
 * `Errors` 组件，用于显示错误信息
 * @param {string} props.code - 错误代码
 *
 * @example
 * ```tsx
 * <Errors code="404" />
 * ```
 */
export default function Errors({ code }: ErrorsProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center">
        <Image
          alt={`"Request error, error code ${code}"`}
          src={`https://http.toshiki.dev/${code}.png`}
        />
      </div>
      <h1 className="text-center font-size-4xl text-3xl">Error {code}</h1>
    </div>
  );
}
