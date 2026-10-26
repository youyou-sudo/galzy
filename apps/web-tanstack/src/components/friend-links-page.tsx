import { EmptyState } from "@web/components/shared/empty-state";
import { PageHeader } from "@web/components/shared/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@web/components/ui/avatar";
import { Card } from "@web/components/ui/card";
import { FRIEND_LINKS_PAGE, type FriendLink } from "@web/lib/friend-links";
import { HeartHandshake } from "lucide-react";

/**
 * 前台友情链接列表：数据由路由 loader 取回后传入。
 *
 * hover 高亮必须只落在光标所在的卡片上。此前这里用 `<MotionHighlight>` 包住整个
 * 网格 div：children 模式下 MotionHighlight 会把它的「唯一子节点」当成一项，于是
 * 整块网格共用同一个 highlight 遮罩——hover 任意一张卡，遮罩都铺满网格，从卡片
 * 间隙和最后一行的空位里透出来；被 hover 的卡片又是半透明背景（bg-muted/40），
 * 与遮罩叠成同色，看起来像好几张卡连成了一大块。
 *
 * 现在回到全站卡片网格（厂商 / 工具 / 话题）的统一做法：
 * `<a className="group">` + `<Card className="group-hover:…">`，hover 只提亮当前卡片。
 * 底色用不透明的 bg-muted 而非 bg-muted/40：卡片本身是不透明 bg-card，半透明的
 * hover 底会让卡片"漏出"页面背景，在暗色主题下反而变暗、几乎看不出 hover。
 */
export default function FriendLinksPage({ links }: { links: FriendLink[] }) {
	return (
		<section className="py-6">
			<PageHeader
				align="center"
				icon={HeartHandshake}
				title={FRIEND_LINKS_PAGE.title}
				description={FRIEND_LINKS_PAGE.description}
			/>

			{links.length === 0 ? (
				<EmptyState
					icon={HeartHandshake}
					title="暂无友链"
					description="还没有添加任何友情链接，过阵子再来看看吧"
				/>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{links.map((item) => (
						<a
							key={item.id}
							href={item.href}
							target="_blank"
							rel="noopener noreferrer"
							className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
						>
							<Card className="h-full transition-colors duration-200 group-hover:bg-muted group-hover:ring-border">
								<div className="flex gap-4 px-4 py-1">
									<Avatar className="shrink-0 size-10 rounded-xl">
										{item.avatar ? (
											<AvatarImage src={item.avatar} alt={item.title} />
										) : null}
										<AvatarFallback className="text-xs bg-muted rounded-xl">
											{item.title.slice(0, 2)}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-col flex-1 gap-1 min-w-0">
										<span className="text-sm font-medium">{item.title}</span>
										{item.description && (
											<span className="text-xs leading-relaxed line-clamp-2 text-muted-foreground">
												{item.description}
											</span>
										)}
									</div>
								</div>
							</Card>
						</a>
					))}
				</div>
			)}
		</section>
	);
}
