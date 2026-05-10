import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="mx-auto w-full max-w-7xl border-b bg-background px-4 py-2 lg:my-4 rounded-full lg:border dark:opacity-70">
			<div className="flex items-center justify-between">
				{/* Left block */}
				<div className="flex items-center">
					<Link to="/" className="flex items-center">
						<Image src="/favicon.ico" width={32} height={32} />
					</Link>
					<div className="hidden md:block">
						<NavigationMenu viewport={false}>
							<NavigationMenuList>
								<NavigationMenuItem>
									<NavigationMenuLink
										asChild
										className={navigationMenuTriggerStyle()}
									>
										<Link to="/">主页</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>

								<NavigationMenuItem>
									<NavigationMenuLink
										asChild
										className={navigationMenuTriggerStyle()}
									>
										<Link to="/contact">联系</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>

								{/* <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link href="/openapi">OpenApi</Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem> */}

								{/* <NavigationMenuItem>
                    <NavigationMenuLink
                      asChild
                      className={navigationMenuTriggerStyle()}
                    >
                      <Link
                        target="_blank"
                        data-umami-event="广告点击"
                        data-umami-event-name="DZMM"
                        data-umami-event-position="导航广告-DZMM"
                        href="https://www.duskpine.top?rf=876926e5"
                      >
                        Ai女友💋（在线畅玩）
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem> */}
							</NavigationMenuList>
						</NavigationMenu>
					</div>
				</div>

				{/* Right block */}
				<div className="flex items-center gap-2">
					<ThemeToggle />

					<div className="md:hidden">
						<Sheet open={isOpen} onOpenChange={setIsOpen}>
							<SheetTrigger asChild>
								<Button variant="ghost" size="icon">
									<Menu className="size-5" />
									<span className="sr-only">打开菜单</span>
								</Button>
							</SheetTrigger>
							<SheetContent side="right" className="w-75 sm:w-100">
								<SheetHeader>
									<SheetTitle className="flex items-center gap-2">
										<Image src="/favicon.ico" width={24} height={24} />
										菜单
									</SheetTitle>
								</SheetHeader>
								<div className="space-y-4">
									<Link
										to="/"
										className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
										onClick={() => setIsOpen(false)}
									>
										主页
									</Link>
								</div>
								<div className="space-y-4">
									<Link
										to="/contact"
										className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
										onClick={() => setIsOpen(false)}
									>
										联系
									</Link>
								</div>
								{/* <div className="space-y-4">
                    <Link
                      target="_blank"
                      data-umami-event="广告点击"
                      data-umami-event-name="DZMM"
                      data-umami-event-position="导航广告-DZMM"
                      href="https://www.duskpine.top?rf=876926e5"
                      className="block px-3 py-2 text-lg font-medium hover:bg-accent hover:text-accent-foreground rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      Ai女友💋（在线畅玩）
                    </Link>
                  </div> */}
							</SheetContent>
						</Sheet>
					</div>
					{/* <Account /> */}
				</div>
			</div>
		</div>
	);
}
