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

/** 元信息标签：与值分列，长列表换行时仍能对齐阅读 */
const metaLabelClass = "shrink-0 pt-0.5 w-8 text-xs text-muted-foreground";
const eyebrowClass =
	"text-xs font-medium tracking-wide text-muted-foreground";

export function GameInfo({ game, gameId }: { game: GameData; gameId: string }) {
	const description = game?.otherData?.description || game?.vn?.description;
	const descriptionPreview = description
		? getDescriptionPreview(description)
		: null;
	const [descriptionOpen, setDescriptionOpen] = useState(false);
	const { onOpenChange: onDescriptionOpenChange } = useBrowserBackModal({
		modalId: `game-description:${gameId}`,
		open: descriptionOpen,
		onOpen: () => setDescriptionOpen(true),
		onClose: () => setDescriptionOpen(false),
	});

	// 先算出过滤结果再决定是否渲染整行：producers 为空数组（kungal-only 条目
	// 常无厂商数据）时，只判断 game?.producers 仍会渲染出「开发」「发行」
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

	const released = game?.released_first
		? formatLooseDate(game.released_first)
		: null;

	const renderProducers = (
		list: typeof developers,
		options?: { muteNg?: boolean },
	) =>
		list.map((producer, index) => (
			<span key={producer.id} className="wrap-break-word">
				<Link
					to={"/producer/$pid"}
					params={{ pid: producer.id }}
					preload="viewport"
					onClick={() =>
						producerHeroActions.fromProducer({
							id: producer.id,
							name: producer.name,
						})
					}
				>
					<span
						className={cn(
							"wrap-break-word transition-colors duration-200 hover:underline",
							options?.muteNg && producer.type === "ng"
								? "text-muted-foreground/70"
								: "text-foreground/85 hover:text-primary",
						)}
						style={vtNameFor(producer.id)}
					>
						{producer.name}
					</span>
				</Link>
				{index < list.length - 1 ? "、" : ""}
			</span>
		));

	const hasMeta =
		!!released || developers.length > 0 || publishers.length > 0;

	return (
		<>
			{hasMeta && (
				<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-baseline mt-3 max-w-4xl text-sm">
					{released && (
						<>
							<dt className={metaLabelClass}>发售</dt>
							<dd className="min-w-0">
								<Link
									to="/search"
									search={{
										startDate: `${released.year}-01-01`,
										endDate: `${released.year}-12-31`,
									}}
									className="group inline-flex gap-1 items-center text-foreground/85 transition-colors duration-200 hover:text-primary"
								>
									{released.year}-{released.formatted}
									<Search
										aria-hidden="true"
										className="size-3 text-muted-foreground transition-colors group-hover:text-primary"
									/>
								</Link>
							</dd>
						</>
					)}

					{developers.length > 0 && (
						<>
							<dt className={metaLabelClass}>开发</dt>
							<dd className="min-w-0">{renderProducers(developers)}</dd>
						</>
					)}

					{publishers.length > 0 && (
						<>
							<dt className={metaLabelClass}>发行</dt>
							<dd className="min-w-0">
								{renderProducers(publishers, { muteNg: true })}
							</dd>
						</>
					)}
				</dl>
			)}

			{description && descriptionPreview && (
				<Dialog open={descriptionOpen} onOpenChange={onDescriptionOpenChange}>
					<div className="mt-3 max-w-3xl">
						<div className={eyebrowClass}>游戏简介</div>
						<div className="mt-1.5 text-sm leading-relaxed text-foreground/85">
							<div className="line-clamp-2 sm:line-clamp-3">
								<BBCodeRenderer inline text={descriptionPreview.text} />
							</div>
							<DialogTrigger
								render={
									<Button
										variant="link"
										size="sm"
										className="px-0 mt-0.5 h-6 text-xs text-primary"
									/>
								}
							>
								查看更多
							</DialogTrigger>
						</div>
					</div>
					<DialogContent className="overflow-hidden max-h-[85vh] sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>游戏简介</DialogTitle>
						</DialogHeader>
						<div className="overflow-x-hidden overflow-y-auto min-w-0 min-h-0 max-h-[70vh] text-sm leading-relaxed text-foreground/85">
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
