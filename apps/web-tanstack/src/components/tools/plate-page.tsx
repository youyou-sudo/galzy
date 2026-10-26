import {
	RadioGroup,
	RadioGroupItem,
} from "@web/components/animate-ui/components/radix/radio-group";
import { PageHeader } from "@web/components/shared/page-header";
import { Button } from "@web/components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@web/components/ui/card";
import { Input } from "@web/components/ui/input";
import { ExternalLink, Hash } from "lucide-react";
import { MotionConfig } from "motion/react";
import { useState } from "react";

type PlateSite = {
	id: string;
	name: string;
	icon: string;
	url?: string;
	channels?: { id: string; name: string; url: string }[];
};

const sites: PlateSite[] = [
	{
		id: "nhentai",
		name: "nhentai",
		channels: [
			{ id: "NH", name: "NH", url: "https://nhentai.net/g/{id}/" },
			{ id: "NHX", name: "NHX", url: "https://nhentai.xxx/g/{id}/" },
		],
		icon: "N",
	},
	{
		id: "18comic",
		name: "禁漫天堂 (18comic)",
		url: "https://18comic.vip/album/{id}/",
		icon: "禁",
	},
	{
		id: "ehentai",
		name: "E-Hentai",
		channels: [
			{ id: "EH", name: "E-Hentai", url: "https://e-hentai.org/g/{id}/" },
			{ id: "EXH", name: "ExHentai", url: "https://exhentai.org/g/{id}/" },
		],
		icon: "E",
	},
	{
		id: "pixiv",
		name: "Pixiv",
		channels: [
			{
				id: "pixiv-artwork",
				name: "作品",
				url: "https://www.pixiv.net/artworks/{id}/",
			},
			{
				id: "pixiv-author",
				name: "作者",
				url: "https://www.pixiv.net/users/{id}/",
			},
		],
		icon: "绘",
	},
	{
		id: "gelbooru",
		name: "Gelbooru",
		url: "https://gelbooru.com/index.php?page=post&s=view&id={id}",
		icon: "G",
	},
	{
		id: "hitomi",
		name: "Hitomi.la",
		url: "https://hitomi.la/galleries/{id}.html",
		icon: "H",
	},
];

/**
 * 车牌号跳转：统一页头 + 一个主输入框 + 站点卡片。
 * 站名图标不再使用六种品牌色，统一为主色淡底，避免一屏六种颜色打架。
 */
export default function RouteComponent() {
	const [plate, setPlate] = useState("");
	const [selectedChannels, setSelectedChannels] = useState<
		Record<string, string>
	>({});

	const openSite = (url: string) => {
		window.open(url, "_blank", "noopener,noreferrer");
	};

	const resolvedUrl = (url: string) =>
		url.replace("{id}", plate.trim() || "{id}");

	return (
		<MotionConfig reducedMotion="user">
			<section className="py-6 mx-auto w-full max-w-2xl">
				<PageHeader
					align="center"
					icon={ExternalLink}
					title="车牌号跳转工具"
					description="输入车牌号，直通车喵～"
				/>

				<div className="relative mb-8">
					<Hash
						aria-hidden="true"
						className="absolute top-1/2 left-4 size-5 text-muted-foreground -translate-y-1/2 pointer-events-none"
					/>
					<Input
						value={plate}
						onChange={(event) => setPlate(event.target.value)}
						placeholder="输入车牌号..."
						aria-label="车牌号"
						className="pl-12 h-12 text-lg rounded-2xl"
					/>
				</div>

				<h2 className="mb-3 text-sm font-medium text-muted-foreground">
					选择班次喵～
				</h2>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{sites.map((site) => {
						const channel =
							site.channels?.find(
								(item) => item.id === selectedChannels[site.id],
							) ?? site.channels?.[0];
						const url = channel?.url ?? site.url ?? "";
						return (
							<Card
								key={site.id}
								className="transition-colors duration-200 hover:ring-border"
							>
								<CardHeader className="pb-2">
									<div className="flex flex-wrap gap-x-3 gap-y-2 items-center">
										<CardTitle className="flex gap-2.5 items-center text-base font-medium">
											<span className="flex shrink-0 justify-center items-center size-8 text-xs font-semibold text-primary bg-primary/10 rounded-lg">
												{site.icon}
											</span>
											{site.name}
										</CardTitle>
										{site.channels && (
											<RadioGroup
												value={channel?.id ?? ""}
												onValueChange={(value: string) =>
													setSelectedChannels((current) => ({
														...current,
														[site.id]: value,
													}))
												}
												className="flex flex-row gap-4 items-center"
											>
												{site.channels.map((item) => (
													<label
														key={item.id}
														htmlFor={`plate-channel-${site.id}-${item.id}`}
														className="flex gap-2 items-center text-sm cursor-pointer"
													>
														<RadioGroupItem
															id={`plate-channel-${site.id}-${item.id}`}
															value={item.id}
														/>
														{item.name}
													</label>
												))}
											</RadioGroup>
										)}
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									{plate.trim() ? (
										<>
											<p className="mb-2 text-xs text-muted-foreground truncate">
												{resolvedUrl(url)}
											</p>
											<Button
												size="sm"
												variant="outline"
												className="w-full"
												onClick={() =>
													openSite(url.replace("{id}", plate.trim()))
												}
											>
												<ExternalLink data-icon="inline-start" />
												打开
											</Button>
										</>
									) : (
										<Button
											size="sm"
											variant="outline"
											className="w-full"
											disabled
										>
											<ExternalLink data-icon="inline-start" />
											输入车牌号后可上车喵～
										</Button>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>
			</section>
		</MotionConfig>
	);
}
