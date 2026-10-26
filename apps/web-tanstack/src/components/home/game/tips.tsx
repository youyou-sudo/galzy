import { Image } from "@unpic/react";
import { Alert, AlertDescription } from "@web/components/ui/alert";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Info } from "lucide-react";

/**
 * 详情页/下载弹窗里的提示与页内广告。
 *
 * 视觉契约：只用中性语义令牌（border-border / bg-muted / text-muted-foreground），
 * 不再用 cyan-600 这类原始调色板；广告内容与 umami 埋点字段原样保留。
 */

const glgc = [
	{
		name: "魔法喵",
		url: "https://umami.galzy.moe/q/e7AV4Eccd",
		desc: "价格实惠、最低 9.9￥- 768 GB 流量、中转高速、GPT & 流媒体解锁",
	},
	{
		name: "从雨云",
		url: "https://umami.galzy.moe/q/d4Jso3Ga8",
		desc: "柚子厨专属 VPN, 中转高速流量，低延迟，流媒体全解锁，又有 0.1 低倍率流量 9 元 1 TB",
		info: "使用 0.1 等低倍率节点下载资源，请调整下载线程为 1 以获得最快下载速度",
	},
	{
		name: "MujikaNetwork",
		url: "https://umami.galzy.moe/q/vSRpFufPA",
		desc: "IEPL专线接入，超低延迟无惧晚高峰、流媒体/AI全解锁、覆盖主流地区节点、设有机场EMBY服（标准订阅计划及以上可享），跨境快车道，就用母鸡卡！",
	},
];

/** 广告行首的 🍚 圆底片：与 IconTile 同尺寸，不引入彩色底 */
const AdBadge = () => (
	<span
		aria-hidden="true"
		className="inline-flex shrink-0 justify-center items-center size-4 text-base leading-none text-muted-foreground bg-muted rounded-full"
	>
		🍚
	</span>
);

const adLinkClass =
	"underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-foreground";

// 页内广告
export const Glgczujm = () => {
	return (
		<div className="flex flex-col gap-2 px-0 mt-4">
			<Alert className="gap-2 px-0 py-1 text-xs text-muted-foreground bg-transparent border-0 opacity-80">
				<Info
					aria-hidden="true"
					className="shrink-0 size-3.5 translate-y-0.5"
				/>
				<AlertDescription className="text-xs leading-relaxed">
					建议使用 IDM 或 Aria2 在一小时内下载完成；PC 端使用 WinRAR，移动端使用
					RAR / ZArchiver；文件请放在全英文路径下。喜欢的话请购买原版或支持作者喵～
				</AlertDescription>
			</Alert>

			{/* DZMM 页内广告：标题 + 图片合在同一张 Card 里，整块可点 */}
			<aside>
				<a
					target="_blank"
					data-umami-event="广告点击"
					data-umami-event-name="DZMM"
					data-umami-event-position="页内广告-DZMM"
					href="https://umami.galzy.moe/q/KrhnTk4vg"
					className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
				>
					<Card className="overflow-hidden gap-0 py-0 transition-colors duration-200 group-hover:bg-muted/40 group-hover:ring-border">
						<CardHeader className="flex gap-2 items-center px-4 py-2 border-b border-border/60">
							<AdBadge />
							<CardTitle className="text-sm font-medium">
								Ai 女友💋（在线畅玩）
							</CardTitle>
							<span className="ml-auto text-[11px] text-muted-foreground">
								广告
							</span>
						</CardHeader>
						<Image
							width={1425}
							height={120}
							src="/dzmm.webp"
							alt="DZMM 广告图片"
							className="object-cover w-full opacity-[0.65] transition-opacity duration-200 group-hover:opacity-100"
						/>
					</Card>
				</a>
			</aside>

			{/* 机场推荐：标题与列表同样收进一张 Card，不再是一个裸标题 + 外部列表 */}
			<aside>
				<Card className="gap-3 py-3">
					<CardHeader className="gap-1.5">
						<CardTitle className="flex gap-2 items-center text-sm font-medium">
							<AdBadge />
							如无法下载 / 速度慢，这里推荐机场
						</CardTitle>
					</CardHeader>
					<CardContent>
						<ul className="grid gap-1.5 pl-4 text-sm list-disc text-muted-foreground">
							{glgc.map((item) => (
								<li key={item.name}>
									<a
										data-umami-event="广告点击"
										data-umami-event-name={item.name}
										data-umami-event-position={`页内广告-${item.name}`}
										className={adLinkClass}
										target="_blank"
										href={item.url}
									>
										{item.name}：{item.desc}
									</a>
									{item.info && (
										<p className="p-0 text-xs text-muted-foreground/80">
											{item.info}
										</p>
									)}
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
			</aside>
		</div>
	);
};

// 下载框广告
export const GlgczujmDl = () => {
	return (
		<aside className="pt-3">
			<div className="flex flex-col gap-2">
				<p className="flex items-center text-sm font-medium text-foreground">
					<span className="mr-2">
						<AdBadge />
					</span>
					如无法下载 / 速度慢，这里推荐机场
				</p>

				<AlertDescription>
					<ul className="flex flex-col gap-1.5 text-sm list-disc list-inside text-muted-foreground">
						{glgc.map((item) => (
							<li key={item.name}>
								<a
									data-umami-event="广告点击"
									data-umami-event-name={item.name}
									data-umami-event-position={`页内广告-${item.name}`}
									className={adLinkClass}
									target="_blank"
									href={item.url}
								>
									{item.name}：{item.desc}
								</a>
								{item.info && (
									<p className="mt-1 ml-5 text-xs leading-snug text-muted-foreground/80">
										{item.info}
									</p>
								)}
							</li>
						))}
					</ul>
				</AlertDescription>
			</div>
		</aside>
	);
};
