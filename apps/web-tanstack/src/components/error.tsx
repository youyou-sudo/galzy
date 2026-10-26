import { Link, useRouter } from "@tanstack/react-router";
import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import { AlertTriangle, Home, RotateCw, Undo2 } from "lucide-react";
import { CodeBlock } from "./code-block";

interface ErrorsProps {
	code: string | number;
	errormessage?: unknown;
}

/**
 * 错误页。
 *
 * 旧版依赖 http.toshiki.dev 的远程 404 图片（断网/被墙时整页空白），且标题、按钮、
 * 错误详情三块各自为政。现在统一为空态语言：图标底片 + 大号错误码 + 说明 + 主次操作，
 * 原始错误详情收进 <details>，默认不干扰普通用户。
 */
export default function Errors({ code, errormessage }: ErrorsProps) {
	const router = useRouter();
	const hasDetail = errormessage !== undefined && errormessage !== null;
	const message =
		typeof errormessage === "string"
			? errormessage
			: "页面加载出错了，刷新或返回首页再试试喵～";

	return (
		<div className="mx-auto w-full max-w-3xl py-10">
			<h1 className="sr-only">错误 {code}</h1>
			<EmptyState
				icon={AlertTriangle}
				title={
					<span className="flex flex-col items-center gap-2">
						<span className="text-6xl font-semibold tracking-tight text-foreground/80 tabular-nums">
							{code}
						</span>
						<span className="text-base font-medium text-foreground/80">
							{Number(code) === 404 ? "页面不存在" : "页面出错了"}
						</span>
					</span>
				}
				description={message}
				action={
					<div className="flex flex-wrap items-center justify-center gap-2">
						<Button render={<Link to="/" />}>
							<Home className="size-4" />
							返回首页
						</Button>
						<Button variant="outline" onClick={() => router.invalidate()}>
							<RotateCw className="size-4" />
							刷新
						</Button>
						<Button
							variant="ghost"
							onClick={() => {
								if (window.history.length > 1) {
									router.history.back();
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
				<details className="mx-auto mt-8 w-full max-w-2xl rounded-2xl bg-card/60 ring-1 ring-border/60">
					<summary className="cursor-pointer list-none px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
						查看错误详情
					</summary>
					<div className="border-t border-border/60 px-2 pb-2">
						<CodeBlock code={JSON.stringify(errormessage, null, 2)} />
					</div>
				</details>
			)}
		</div>
	);
}
