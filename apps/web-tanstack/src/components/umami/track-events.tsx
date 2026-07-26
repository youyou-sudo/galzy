import { useEffect } from "react";

const API_HOST = process.env.API_HOST || "http://localhost:3001";

interface GameViewsTrackEventsProps {
	idtitle: string;
}

export function GameViewsTrackEvents({ idtitle }: GameViewsTrackEventsProps) {
	useEffect(() => {
		fetch(`${API_HOST}/views/game`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ gameId: idtitle }),
		}).catch(() => {});
	}, [idtitle]);
	return null;
}

interface TagViewsTrackEventsProps {
	tagId: string;
}

export function TagViewsTrackEvents({ tagId }: TagViewsTrackEventsProps) {
	useEffect(() => {
		fetch(`${API_HOST}/views/tag`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ tagId }),
		}).catch(() => {});
	}, [tagId]);
	return null;
}
