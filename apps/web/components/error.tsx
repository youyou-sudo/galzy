'use client'

import { useRouter } from '@bprogress/next/app'
import { Button } from '@web/components/ui/button'
import { CodeBlock } from '@web/components/code-block'
import Image from 'next/image'

interface ErrorsProps {
  code: string
  errormessage?: any
}
/**
 * 错误组件，用于显示错误信息和错误代码
 * @component
 * @param {ErrorsProps} props - 组件属性
 * @param {string} props.code - 要显示的错误代码（例如 "404"、"500"）
 * @param {any} [props.errormessage] - 可选的错误信息，显示在错误代码下方
 *
 * @returns {JSX.Element} 一个显示错误图片、错误代码和可选错误信息的组件
 *
 * @example
 * ```tsx
 * // 基本用法
 * <Errors code="404" />
 *
 * // 包含错误信息
 * <Errors
 *   code="500"
 *   errormessage={{
 *     message: "服务器内部错误",
 *     details: "发生了一些错误"
 *   }}
 * />
 * ```
 */
export default function Errors({ code, errormessage }: ErrorsProps) {
  const router = useRouter()
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center">
        <Image
          unoptimized
          width={400}
          height={400}
          alt={`"Request error, error code ${code}"`}
          src={`https://http.toshiki.dev/${code}.png`}
          loading="lazy"
          className="rounded-lg"
        />
      </div>
      <h1 className="text-center font-size-4xl text-3xl">Error {code}</h1>
      <div className="flex justify-center space-y-2">
        <Button className="w-28" onClick={() => router.back()}>
          返回上一页
        </Button>
      </div>
      {errormessage && (
        <div className="text-center mt-2 flex justify-center">
          <CodeBlock code={JSON.stringify(errormessage)} language="text" />
        </div>
      )}
    </div>
  )
}
