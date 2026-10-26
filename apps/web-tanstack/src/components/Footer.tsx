import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ExternalLink } from "lucide-react";

const START_YEAR = 2022;

const linkClass =
	"inline-flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors duration-200 hover:text-foreground";

function Copyright() {
	const currentYear = new Date().getFullYear();
	const years =
		currentYear > START_YEAR
			? `${START_YEAR}–${currentYear}`
			: String(START_YEAR);
	return <span>© {years} GalZY</span>;
}

/**
 * 用户端页脚。
 *
 * 与顶栏同一套语言：发丝分隔线、克制的灰、hover 才提亮；不再堆三方链接的蓝色下划线。
 * 内容宽度与 __root 的 main 对齐（max-w-7xl），短页面由 main 的 flex-1 把页脚压在底部。
 */
export default function Footer() {
	return (
		<footer className="mt-16 border-t border-border/60">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2.5">
						<span className="flex size-8 items-center justify-center overflow-hidden rounded-xl ring-1 ring-border/60">
							<Image
								src="/favicon.ico"
								width={20}
								height={20}
								alt=""
								className="size-5"
							/>
						</span>
						<span className="text-sm font-semibold tracking-tight">GalZY</span>
						<span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
							Galgame 资源站
						</span>
					</div>
					<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
						<Copyright />
						<span aria-hidden="true" className="text-border">
							·
						</span>
						<span>用爱发电喵～</span>
					</p>
				</div>

				<nav
					aria-label="页脚导航"
					className="flex flex-wrap items-center gap-x-6 gap-y-2"
				>
					<Link to="/openapi" className={linkClass}>
						Open API
					</Link>
					<Link to="/friend-links" className={linkClass}>
						友情链接
					</Link>
					<Link to="/tools" className={linkClass}>
						工具箱
					</Link>
					<a
						href="https://icp.gov.moe/?keyword=20222332"
						target="_blank"
						rel="noopener noreferrer"
						className={linkClass}
					>
						萌ICP备20222332号
						<ExternalLink className="size-3" />
					</a>
				</nav>
			</div>
		</footer>
	);
}
