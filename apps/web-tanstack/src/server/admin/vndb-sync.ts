import { api } from "@libs";
import { createServerFn } from "@tanstack/react-start";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";

export const getSyncProgress = createServerFn({ method: "GET" }).handler(
	async () => {
		const { data, error } = await api["vndb-sync"].progress.get(cookiePass());
		elysiaErrorF(error);
		return data;
	},
);

export const triggerFullSync = createServerFn({ method: "POST" }).handler(
	async () => {
		const { data, error } = await api["vndb-sync"].full.post({}, cookiePass());
		elysiaErrorF(error);
		return data;
	},
);

export const triggerDeltaSync = createServerFn({ method: "POST" }).handler(
	async () => {
		const { data, error } = await api["vndb-sync"].delta.post({}, cookiePass());
		elysiaErrorF(error);
		return data;
	},
);

export const triggerProducersSync = createServerFn({ method: "POST" }).handler(
	async () => {
		const { data, error } = await api["vndb-sync"].producers.post(
			{},
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	},
);

export const getCloudreveSyncStatus = createServerFn({
	method: "GET",
}).handler(async () => {
	const { data, error } = await api["vndb-sync"].cloudreve.get(cookiePass());
	elysiaErrorF(error);
	return data;
});

export const triggerCloudreveSync = createServerFn({ method: "POST" }).handler(
	async () => {
		const { data, error } = await api["vndb-sync"].cloudreve.sync.post(
			{},
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	},
);

export const checkCloudreveFiles = createServerFn({ method: "POST" }).handler(
	async () => {
		const { data, error } = await api["vndb-sync"].cloudreve.check.post(
			{},
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	},
);
