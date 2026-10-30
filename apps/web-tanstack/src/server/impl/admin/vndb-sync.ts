import "@teyik0/furin/server-only";
import { defineBffNoInput } from "@web/lib/bff/define";
import { api } from "@libs";
import { elysiaErrorF } from "@web/lib";
import { cookiePass } from "@web/lib/cookie-pass";

export const getSyncProgress = defineBffNoInput(async () => {
		const { data, error } = await api["vndb-sync"].progress.get(cookiePass());
		elysiaErrorF(error);
		return data;
	},);

export const triggerFullSync = defineBffNoInput(async () => {
		const { data, error } = await api["vndb-sync"].full.post({}, cookiePass());
		elysiaErrorF(error);
		return data;
	},);

export const triggerDeltaSync = defineBffNoInput(async () => {
		const { data, error } = await api["vndb-sync"].delta.post({}, cookiePass());
		elysiaErrorF(error);
		return data;
	},);

export const triggerProducersSync = defineBffNoInput(async () => {
		const { data, error } = await api["vndb-sync"].producers.post(
			{},
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	},);

export const getCloudreveSyncStatus = defineBffNoInput(async () => {
	const { data, error } = await api["vndb-sync"].cloudreve.get(cookiePass());
	elysiaErrorF(error);
	return data;
});

export const triggerCloudreveSync = defineBffNoInput(async () => {
		const { data, error } = await api["vndb-sync"].cloudreve.sync.post(
			{},
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	},);

export const checkCloudreveFiles = defineBffNoInput(async () => {
		const { data, error } = await api["vndb-sync"].cloudreve.check.post(
			{},
			cookiePass(),
		);
		elysiaErrorF(error);
		return data;
	},);
