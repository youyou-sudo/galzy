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
import type { getGameDetail } from "@web/server/game";
import { Search } from "lucide-react";
import { useState } from "react";

type GameData = NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;

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

	return (
		<>
			{/* 发行日期 */}
			{game?.released_first && (
				<div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
					发布：
					<Link
						to="/search"
						search={{
							startDate: `${formatLooseDate(game.released_first ?? undefined).year}-01-01`,
							endDate: `${formatLooseDate(game.released_first ?? undefined).year}-12-31`,
						}}
						className="relative inline-flex items-center gap-0.5 text-cyan-600"
					>
						<span className="relative">
							{formatLooseDate(game.released_first ?? undefined).year}-
							{formatLooseDate(game.released_first ?? undefined).formatted}
							<Search className="absolute -top-1 -right-3 size-3 text-zinc-400" />
						</span>
					</Link>
				</div>
			)}

			{/* 开发组织 */}
			{game?.producers && (
				<div className="text-sm text-zinc-500 dark:text-zinc-400">
					开发：
					{game.producers
						.filter((producer) => producer.type === "co")
						.filter((producer) => producer.is_dev === true)
						.map((producer, index, arr) => (
							<Link
								to={`/producer/$pid`}
								params={{ pid: producer.id }}
								key={producer.id}
							>
								<span className="relative inline-flex items-center gap-0.5 text-cyan-600 wrap-break-word hover:underline">
									{producer.name}
								</span>
								{index < arr.length - 1 ? " & " : ""}
							</Link>
						))}
				</div>
			)}

			{/* 发行组织 */}
			{game?.producers && (
				<div className="text-sm">
					<span className="text-zinc-500 dark:text-zinc-400">发行：</span>
					<span className="">
						{game.producers
							.filter((producer) => producer.is_pub === true)
							.map((producer, index, arr) => (
								<Link
									to={`/producer/$pid`}
									params={{ pid: producer.id }}
									key={producer.id}
								>
									<span
										className={`${producer.type === "ng" ? "text-cyan-900 opacity-50 dark:opacity-100" : "text-cyan-600"} wrap-break-word hover:underline`}
									>
										{producer.name}
									</span>
									{index < arr.length - 1 ? (
										<span className="text-zinc-500 dark:text-zinc-400 opacity-100">
											{" "}
											&{" "}
										</span>
									) : (
										""
									)}
								</Link>
							))}
					</span>
				</div>
			)}

			{/* Description */}
			{description && (
				<Dialog open={descriptionOpen} onOpenChange={onDescriptionOpenChange}>
					<div className="mt-2">
						<div className="text-xs text-zinc-500 uppercase mb-1">游戏简介</div>
						<div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
							<BBCodeRenderer inline text={descriptionPreview} />
							<DialogTrigger
								render={
									<Button
										variant="link"
										size="xs"
										className="ml-1 h-auto p-0 align-baseline"
									/>
								}
							>
								查看更多
							</DialogTrigger>
						</div>
					</div>
					<DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
						<DialogHeader>
							<DialogTitle>游戏简介</DialogTitle>
						</DialogHeader>
						<div className="min-h-0 min-w-0 max-h-[70vh] overflow-x-hidden overflow-y-auto text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
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
