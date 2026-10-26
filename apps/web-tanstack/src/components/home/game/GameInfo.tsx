import { Link } from "@tanstack/react-router";
import { BBCodeRenderer, getDescriptionPreview } from "@web/components/bbcode";
import { TagsCard } from "@web/components/home/game/tags";
import { Button } from "@web/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@web/components/ui/dialog";
import { useBrowserBackModal } from "@web/hooks/use-browser-back-modal";
import { formatLooseDate } from "@web/lib";
import { cn } from "@web/lib/utils";
import type { getGameDetail } from "@web/server/game";
import { producerHeroActions } from "@web/stores/producerHeroStore";
import { Search } from "lucide-react";
import { useState } from "react";

type GameData = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

/** 元信息行：与 pending 骨架的「发布：/开发：/发行：」三行同字号同色 */
const infoRowClass = "text-sm text-muted-foreground";
/** 行内主链接：默认就是 secondary 灰，hover 才提亮（顶栏语言） */
const metaLinkClass =
	"text-primary transition-colors duration-200 hover:text-primary/80";
/** 小眉标：与 PageHeader 的 eyebrow 同一套字距与透明度 */
const eyebrowClass =
	"mb-1 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase";

export function GameInfo({ game, gameId }: { game: GameData; gameId: string }) {
	const description = game?.otherData?.description || game?.vn?.description;
	const descriptionPreview = description
		? getDescriptionPreview(description).text
		: "";
	const [descriptionOpen, setDescriptionOpen] = useState(false);
	const { onOpenChange: onDescriptionOpenChange } = useBrowserBackModal({
		modalId: `game-description:${gameId}`,
		open: descriptionOpen,
		onOpen: () => setDescriptionOpen(true),
		onClose: () => setDescriptionOpen(false),
	});
	// 先算出过滤结果再决定是否渲染整行：producers 为空数组（kungal-only 条目
	// 常无厂商数据）时，只判断 game?.producers 仍会渲染出「开发：」「发行：」
	// 两个只有标签没有内容的空行。
	const developers =
		game?.producers
			?.filter((producer) => producer.type === "co")
			.filter((producer) => producer.is_dev === true) ?? [];
	const publishers =
		game?.producers?.filter((producer) => producer.is_pub === true) ?? [];
	// 同一厂商会同时出现在开发/发行两栏：VT 同名快照重复会让浏览器中止
	// 整场过渡（Unexpected duplicate view-transition-name），因此每个 pid
	// 只给首个出现的元素挂名。
	const vtNamedPids = new Set<string>();
	const vtNameFor = (pid: string) => {
		if (vtNamedPids.has(pid)) return undefined;
		vtNamedPids.add(pid);
		return {
			viewTransitionName: `producer-name-${pid}`,
			viewTransitionClass: "producer-name vt-text",
		};
	};

	return (
		<>
			{/* 发行日期 */}
			{game?.released_first && (
				<div className={`${infoRowClass} mt-1`}>
					发布：
					<Link
						to="/search"
						search={{
							startDate: `${formatLooseDate(game.released_first ?? undefined).year}-01-01`,
							endDate: `${formatLooseDate(game.released_first ?? undefined).year}-12-31`,
						}}
						className="group inline-flex items-center gap-1 text-primary transition-colors duration-200 hover:text-primary/80"
					>
						{formatLooseDate(game.released_first ?? undefined).year}-
						{formatLooseDate(game.released_first ?? undefined).formatted}
						<Search
							aria-hidden="true"
							className="size-3 text-muted-foreground transition-colors group-hover:text-primary"
						/>
					</Link>
				</div>
			)}

			{/* 开发组织 */}
			{developers.length > 0 && (
				<div className={infoRowClass}>
					开发：
					{developers.map((producer, index, arr) => (
						<span key={producer.id}>
							<Link
								to={"/producer/$pid"}
								params={{ pid: producer.id }}
								preload="viewport"
								onClick={() => producerHeroActions.set(producer.id)}
							>
								<span
									className={`${metaLinkClass} wrap-break-word hover:underline`}
									style={vtNameFor(producer.id)}
								>
									{producer.name}
								</span>
							</Link>
							{index < arr.length - 1 ? " & " : ""}
						</span>
					))}
				</div>
			)}

			{/* 发行组织 */}
			{publishers.length > 0 && (
				<div className={infoRowClass}>
					发行：
					{publishers.map((producer, index, arr) => (
						<span key={producer.id}>
							<Link
								to={"/producer/$pid"}
								params={{ pid: producer.id }}
								preload="viewport"
								onClick={() => producerHeroActions.set(producer.id)}
							>
								<span
									className={cn(
										"wrap-break-word transition-colors duration-200 hover:underline",
										producer.type === "ng"
											? "text-muted-foreground/70"
											: "text-primary hover:text-primary/80",
									)}
									style={vtNameFor(producer.id)}
								>
									{producer.name}
								</span>
							</Link>
							{index < arr.length - 1 ? " & " : ""}
						</span>
					))}
				</div>
			)}

			{/* Description */}
			{description && (
				<Dialog open={descriptionOpen} onOpenChange={onDescriptionOpenChange}>
					<div className="mt-4">
						<div className={eyebrowClass}>游戏简介</div>
						<div className="text-sm leading-relaxed text-foreground/85">
							<div className="relative line-clamp-3 pr-14 sm:line-clamp-4">
								<BBCodeRenderer inline text={descriptionPreview} />
								<DialogTrigger
									render={
										<Button
											variant="ghost"
											size="sm"
											className="absolute right-0 bottom-0 z-10 bg-card px-2 text-primary hover:bg-muted hover:text-primary"
										/>
									}
								>
									查看更多
								</DialogTrigger>
							</div>
						</div>
					</div>
					<DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>游戏简介</DialogTitle>
						</DialogHeader>
						<div className="max-h-[70vh] min-h-0 min-w-0 overflow-x-hidden overflow-y-auto text-sm leading-relaxed text-foreground/85">
							<BBCodeRenderer
								text={
									game?.otherData?.description || game?.vn?.description || ""
								}
							/>
						</div>
					</DialogContent>
				</Dialog>
			)}
			{/* Tags section */}
			<TagsCard />
		</>
	);
}
