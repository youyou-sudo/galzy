import { Button } from "@/components/ui/button";
import { CodeBlock } from "./code-block";
import { Link, useNavigate } from "@tanstack/react-router";
import { Image } from "@unpic/react";

interface ErrorsProps {
	code: string;
	errormessage?: any;
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
	const navigate = useNavigate();
	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-center">
				<Image
					width={400}
					height={400}
					alt={`"Request error, error code ${code}"`}
					src={`https://http.toshiki.dev/${code}.png`}
					loading="lazy"
					className="rounded-lg"
				/>
			</div>
			<h1 className="text-center font-size-4xl text-3xl">Error {code}</h1>
			<div className="flex justify-center space-y-2 gap-2">
				<Link to={"/"}>
					<Button>返回首页</Button>
				</Link>

				<Button
					className="w-28"
					onClick={() => {
						if (window.history.length > 1) {
							navigate({ to: "." });
						} else {
							navigate({ to: "/" }); // fallback
						}
					}}
				>
					返回上一页
				</Button>
			</div>
			{errormessage && (
				<div className="w-full max-w-3xl mx-auto">
					<CodeBlock
						code={JSON.stringify(errormessage, null, 2)}
						language="text"
					/>
				</div>
			)}
		</div>
	);
}
