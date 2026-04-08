import { BProgress } from "@bprogress/core";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

export function RouterProgress() {
	const status = useRouterState({
		select: (s) => s.status,
	});

	useEffect(() => {
		if (status === "pending") {
			BProgress.start();
		} else {
			BProgress.done();
		}
	}, [status]);

	return null;
}
