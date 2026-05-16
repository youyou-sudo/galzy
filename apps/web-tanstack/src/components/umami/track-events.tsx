import { useEffect } from "react";

// 全局声明 umami 避免 TS 报错
declare const umami: {
	track: (event: string, data?: Record<string, any>) => void;
};

interface GameViewsTrackEventsProps {
	idtitle: string;
}

export function GameViewsTrackEvents({ idtitle }: GameViewsTrackEventsProps) {
	useEffect(() => {
		if (typeof umami !== "undefined") {
			umami.track("GameViews", { idtitlee: idtitle });
			console.log("GameViewsTrackEvents");
		}
	}, [idtitle]);
	return null;
}

interface TagViewsTrackEventsProps {
	tagtitle: string;
}

export function TagViewsTrackEvents({ tagtitle }: TagViewsTrackEventsProps) {
	useEffect(() => {
		if (typeof umami !== "undefined") {
			umami.track("TagViews", { tagtitle });
			console.log("TagViewsTrackEvents");
		}
	}, [tagtitle]);
	return null;
}
