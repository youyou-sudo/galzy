import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { seoTemplate } from "#/config/seoTemplate";

export const Route = createFileRoute("/contact")({
	component: RouteComponent,
	head: () => ({
		meta: [{ title: `联系喵喵们 | ${seoTemplate.title}` }],
	}),
});

function RouteComponent() {
	return (
		<section className="flex justify-center items-center">
			<div className="p-4 w-full max-w-md">
				<Card className="shadow-lg rounded-2xl">
					<CardHeader>
						<CardTitle className="flex items-center justify-center text-4xl font-extrabold">
							联系喵喵们
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<section className="text-center space-y-2">
							<h2 className="text-xl font-semibold opacity-80">
								喵喵喵通知公告
							</h2>
							<p>
								频道：{" "}
								<a
									href="https://t.me/ziyuanlinyin"
									target="_blank"
									className="text-blue-500 underline hover:text-blue-700 transition-colors"
									rel="noopener"
								>
									t.me/ziyuanlinyin
								</a>
							</p>
						</section>

						<section className="text-center space-y-2">
							<h2 className="text-xl font-semibold opacity-80">
								问题反馈和合作赞助
							</h2>
							<p className="">
								邮箱：{" "}
								<a
									href="mailto:GalzyAdvertising@proton.me"
									target="_blank"
									className="text-blue-500 underline hover:text-blue-700 transition-colors"
									rel="noopener"
								>
									GalzyAdvertising@proton.me
								</a>
							</p>
						</section>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
