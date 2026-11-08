import { EmptyState } from "@web/components/shared/empty-state";
import { Button } from "@web/components/ui/button";
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockCopyButton,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@web/components/ui/code-block";
import { Link, useRouter } from "@web/lib/nav";
import {
	AlertTriangle,
	ChevronRight,
	Home,
	RotateCw,
	Undo2,
} from "lucide-react";

interface ErrorsProps {
	code: string | number;
	/** 正文说明（字符串时直接展示，否则用默认文案） */
	errormessage?: unknown;
	/** 折叠区展示的原始错误（message / digest / status 等） */
	detail?: unknown;
}

/**
 * 把原始错误整理成代码块可展示、可复制的文本。
 *
 * furin 传的是 `{ message, digest, status }` 普通对象，统一按 JSON 展开；
 * 字符串原样保留，Error 实例只取 message（不把 stack 里的服务器路径送给浏览器）。
 */
function formatDetail(detail: unknown): string | null {
	if (detail === undefined || detail === null) return null;
	if (typeof detail === "string") return detail.trim() ? detail : null;
	// 不展示 Error.stack：堆栈里带着服务器路径，furin 用 digest 关联日志即可。
	if (detail instanceof Error) return detail.message;
	try {
		return JSON.stringify(detail, null, 2) ?? String(detail);
	} catch {
		return String(detail);
	}
}

/**
 * 错误页。
 *
 * 旧版依赖 http.toshiki.dev 的远程 404 图片（断网/被墙时整页空白），且标题、
 * 按钮、错误详情三块各自为政。现在统一为空态语言：图标底片 + 大号错误码 +
 * 说明 + 主次操作，原始错误详情收进 <details>，默认不干扰普通用户。
 *
 * 详情区用 shadcn 的 CodeBlock（`components/ui/code-block`）渲染：等宽字体、
 * 破坏性配色、行内滚动与一键复制。`<code>` 手写块已经删除，避免两套代码
 * 展示样式继续分叉。
 *
 * 注意：furin 传给页面组件的 `error` 是 `{ message, digest, status }` 普通对象，
 * **不是 Error 实例**（见 @teyik0/furin 的 shared/error.ts）。旧实现只认
 * `instanceof Error`，于是所有异常都被降级成「页面加载出错喵～」，真实原因始终
 * 看不到——排查后台点「查看站点」500 时这一点很致命。现在原始 message 与 digest
 * 会进折叠区，正文仍保持对普通用户友好的文案。
 */
export default function Errors({ code, errormessage, detail }: ErrorsProps) {
	const router = useRouter();
	const detailText = formatDetail(detail);
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

			{detailText && (
				<details className="mx-auto mt-8 w-full max-w-2xl group">
					<summary className="flex gap-1 items-center px-1 py-2 text-xs list-none text-muted-foreground transition-colors cursor-pointer hover:text-foreground">
						<ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
						查看错误详情
					</summary>
					<div className="mt-2">
						<CodeBlock variant="destructive">
							<CodeBlockHeader>
								<CodeBlockTitle>错误代码</CodeBlockTitle>
								<CodeBlockActions>
									<CodeBlockCopyButton value={detailText} />
								</CodeBlockActions>
							</CodeBlockHeader>
							<CodeBlockContent wrap className="max-h-72">
								{detailText}
							</CodeBlockContent>
						</CodeBlock>
					</div>
				</details>
			)}
		</div>
	);
}
