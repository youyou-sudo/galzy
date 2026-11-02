import { PageHeader } from "@web/components/shared/page-header";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Mail } from "lucide-react";

const linkClass =
	"font-medium text-primary no-underline transition-colors hover:text-primary/80";

/** 联系页：统一页头 + 一张克制的信息卡，不再用 4xl/extrabold 标题与蓝色链接。 */
export default function RouteComponent() {
	return (
		<section className="py-6 mx-auto w-full max-w-xl">
			<PageHeader
				align="center"
				icon={Mail}
				title="联系喵喵们"
				description="问题反馈、合作赞助与防失联入口"
			/>

			<Card>
				<CardHeader>
					<CardTitle className="text-base font-medium">喵喵喵通知公告</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>
						频道：{" "}
						<a
							href="https://t.me/ziyuanlinyin"
							target="_blank"
							className={linkClass}
							rel="noopener noreferrer"
						>
							t.me/ziyuanlinyin
						</a>
					</p>
				</CardContent>
			</Card>

			<Card className="mt-4">
				<CardHeader>
					<CardTitle className="text-base font-medium">
						问题反馈和合作赞助
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm text-muted-foreground">
					<p>
						邮箱：{" "}
						<a href="mailto:GalzyAdvertising@proton.me" className={linkClass}>
							GalzyAdvertising@proton.me
						</a>
					</p>
					<p>记得在邮件写明相关的信息喵～喵喵谢谢各位喵～</p>
				</CardContent>
			</Card>
		</section>
	);
}
