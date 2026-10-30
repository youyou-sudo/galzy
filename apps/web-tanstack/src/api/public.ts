import { Elysia } from "elysia";

import background from "../../public/background.webp" with { type: "file" };
import dzmm from "../../public/dzmm.webp" with { type: "file" };
import favicon from "../../public/favicon.ico" with { type: "file" };
import hikarinagi from "../../public/hikarinagi-icon.webp" with { type: "file" };
import kungal from "../../public/kungal.webp" with { type: "file" };
import linuxdo from "../../public/linuxdo.webp" with { type: "file" };
import neko from "../../public/neko.webp" with { type: "file" };
import noImage from "../../public/No-Image-Placeholder.svg.webp" with { type: "file" };
import robots from "../../public/robots.txt" with { type: "file" };
import telegram from "../../public/telegram.png" with { type: "file" };

/**
 * Root-path aliases for public assets.
 *
 * Furin serves the public directory under /public/*, but data-driven URLs
 * (advert materials, friend-link icons, robots.txt) were stored as root paths
 * by the previous frontend. Keep those URLs working so existing data and
 * parity with the old site are preserved.
 *
 * The imports above also make the files part of the production asset graph,
 * so compiled (embed) binaries serve them from the executable.
 */
const ROOT_ASSETS: Record<string, string> = {
	"/background.webp": background,
	"/dzmm.webp": dzmm,
	"/favicon.ico": favicon,
	"/hikarinagi-icon.webp": hikarinagi,
	"/kungal.webp": kungal,
	"/linuxdo.webp": linuxdo,
	"/neko.webp": neko,
	"/No-Image-Placeholder.svg.webp": noImage,
	"/robots.txt": robots,
	"/telegram.png": telegram,
};

let publicApi = new Elysia();
for (const [path, file] of Object.entries(ROOT_ASSETS)) {
	publicApi = publicApi.get(path, {}, () => {
		// In a bundled/compiled build the import resolves to an emitted asset path
		// relative to the server entry, so resolve it against import.meta.url.
		const resolved = new URL(file, import.meta.url);
		return new Response(Bun.file(resolved));
	});
}

export { publicApi };