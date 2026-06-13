import { Link } from "@tanstack/react-router";
import { AspectRatio } from "../ui/aspect-ratio";
import { Skeleton } from "../ui/skeleton";
import { GameCard } from "./card";

type GameItemProps = {
	gameid: string;
	title: string;
	width?: number;
	height?: number;
	src: string;
};

// 小组件：单个游戏卡片
export const GameItem = ({
	gameid,
	width,
	height,
	src,
	title,
}: GameItemProps) => {
	return (
		<Link to="/$id" params={{ id: gameid }}>
			<AspectRatio
				ratio={9 / 13}
				className="block relative overflow-hidden rounded-lg"
				style={{ contentVisibility: "auto" }}
			>
				<Skeleton className="absolute inset-0 w-full h-full" />
				<GameCard.Image
					width={width ?? 200}
					height={height ?? 300}
					loading="lazy"
					decoding="async"
					src={src}
					alt={title || " "}
					className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-200"
				/>
			</AspectRatio>
			<p className="text-sm truncate w-full text-center px-2 pt-2">{title}</p>
		</Link>
	);
};
