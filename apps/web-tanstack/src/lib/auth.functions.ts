import { createServerFn } from "@tanstack/react-start";
import { authServerClient } from "./auth.server";

export const getSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: session } = await authServerClient.getSession();

		return session;
	},
);

export const ensureSession = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data: session } = await authServerClient.getSession();

		if (!session) {
			throw new Error("Unauthorized");
		}

		return session;
	},
);
