import { Link, useRouter } from "@web/lib/nav";
import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import { AlertTriangle, Home, RotateCw, Undo2 } from "lucide-react";
import { CodeBlock } from "./code-block";

interface ErrorsProps {
	code: string | number;
	/** 正文说明（字符串时直接展示，否则用默认文案） */
	errormessage?: unknown;
	/** 折叠区展示的原始错误（message / digest / status 等） */
	detail?: unknown;
}

/**
 * 错误页。
 *
 * 旧版依赖 http.toshiki.dev 的远程 404 图片（断网/被墙时整页空白），且标题、按钮、
 * 错误详情三块各自为政。现在统一为空态语言：图标底片 + 大号错误码 + 说明 + 主次操作，
 * 原始错误详情收进 <details>，默认不干扰普通用户。
 *
 * 注意：furin 传给页面组件的 `error` 是 `{ message, digest, status }` 普通对象，
 * **不是 Error 实例**（见 @teyik0/furin 的 shared/error.ts）。旧实现只认
 * `instanceof Error`，于是所有异常都被降级成「页面加载出错喵～」，真实原因始终
 * 看不到——排查后台点「查看站点」500 时这一点很致命。现在原始 message 与 digest
 * 会进折叠区，正文仍保持对普通用户友好的文案。
 */
export default function Errors({ code, errormessage, detail }: ErrorsProps) {
	const router = useRouter();
	const hasDetail = detail !== undefined && detail !== null;
	const message =
		typeof errormessage === "string" && errormessage.trim()
			? errormessage
			: "页面加载出错了，刷新或返回首页再试试喵～";

	return (
		<div className="py-10 mx-auto w-full max-w-3xl">
			<h1 className="sr-only">错误 {code}</h1>
			<EmptyState
				icon={AlertTriangle}
				title={
					<span className="flex flex-col gap-2 items-center">
						<span className="text-6xl font-semibold tabular-nums tracking-tight text-foreground/80">
							{code}
						</span>
						<span className="text-base font-medium text-foreground/80">
							{Number(code) === 404 ? "页面不存在" : "页面出错了"}
						</span>
					</span>
				}
				description={message}
				action={
					<div className="flex flex-wrap gap-2 justify-center items-center">
						<Button render={<Link to="/" />}>
							<Home className="size-4" />
							返回首页
						</Button>
						<Button variant="outline" onClick={() => router.refresh()}>
							<RotateCw className="size-4" />
							刷新
						</Button>
						<Button
							variant="ghost"
							onClick={() => {
								if (window.history.length > 1) {
									window.history.back();
								} else {
									void router.navigate({ to: "/" });
								}
							}}
						>
							<Undo2 className="size-4" />
							返回上一页
						</Button>
					</div>
				}
			/>

			{hasDetail && (
				<details className="mx-auto mt-8 w-full max-w-2xl bg-card/60 rounded-2xl ring-1 ring-border/60">
					<summary className="px-4 py-3 text-xs list-none text-muted-foreground transition-colors cursor-pointer hover:text-foreground">
						查看错误详情
					</summary>
					<div className="px-2 pb-2 border-t border-border/60">
						<CodeBlock code={JSON.stringify(detail, null, 2)} />
					</div>
				</details>
			)}
		</div>
	);
}
