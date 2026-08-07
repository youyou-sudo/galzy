import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { Button } from "@web/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@web/components/ui/sheet";
import { Separator } from "@web/components/ui/separator";
import { cn } from "@web/lib/utils";
import {
	Building2,
	ExternalLink,
	Home,
	Mail,
	MessageSquare,
	Tags,
	Wrench,
} from "lucide-react";

const mainLinks = [
	{ to: "/", label: "主页", icon: Home },
	{ to: "/tags", label: "标签", icon: Tags },
	{ to: "/producer", label: "会社", icon: Building2 },
	{ to: "/topics", label: "论坛", icon: MessageSquare },
	{ to: "/contact", label: "联系", icon: Mail },
] as const;

const toolLinks = [
	{
		to: "/tools",
		label: "所有工具",
		icon: Wrench,
		description: "查看全部实用工具",
	},
	{
		to: "/tools/plate",
		label: "车牌号跳转",
		icon: ExternalLink,
		description: "快速跳转到 nhentai、禁漫天堂等网站",
	},
] as const;

// 移动端导航菜单。整体懒加载：dialog/scroll-lock 代码只在首次打开时进入客户端 bundle。
// 使用 side="top" 的 Sheet，入场动画见 styles.css 的 galzy-sheet-top-drop keyframes（从上往下滑入）。
export function HeaderMobileMenu({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="top"
				className="gap-2 max-h-[80dvh] overflow-y-auto rounded-b-2xl px-2 pb-4"
			>
				<SheetHeader className="flex-row items-center gap-2 px-3 pt-4 pb-2">
					<Image
						src="/favicon.ico"
						width={28}
						height={28}
						className="size-7 rounded-md"
					/>
					<SheetTitle>菜单</SheetTitle>
				</SheetHeader>
				<nav className="flex flex-col gap-3 px-2 pb-2">
					<div className="grid grid-cols-2 gap-2">
						{mainLinks.map(({ to, label, icon: Icon }, index) => (
							<Button
								key={to}
								variant="outline"
								nativeButton={false}
								className={cn(
									"h-12 w-full justify-start gap-2.5 px-3 text-base font-medium",
									index === mainLinks.length - 1 && "col-span-2",
								)}
								render={
									<Link to={to} onClick={() => onOpenChange(false)} />
								}
							>
								<Icon data-icon="inline-start" />
								{label}
							</Button>
						))}
					</div>
					<Separator />
					<div className="flex flex-col gap-1">
						<p className="px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							工具
						</p>
						{toolLinks.map(({ to, label, icon: Icon, description }) => (
							<Button
								key={to}
								variant="ghost"
								nativeButton={false}
								className="h-auto w-full justify-start gap-3 px-3 py-2.5"
								render={
									<Link to={to} onClick={() => onOpenChange(false)} />
								}
							>
								<Icon data-icon="inline-start" />
								<div className="flex flex-col items-start gap-0.5">
									<span className="text-sm font-medium">{label}</span>
									<span className="text-xs font-normal text-muted-foreground">
										{description}
									</span>
								</div>
							</Button>
						))}
					</div>
				</nav>
			</SheetContent>
		</Sheet>
	);
}
