import { Elysia } from "elysia";

/**
 * Root-path aliases for files served from `public/`.
 *
 * Furin serves the public directory under `/public/*`, but plenty of URLs still
 * arrive as root paths: advert materials and friend-link avatars are stored in
 * the database as `/dzmm.webp` / `/telegram.png`, and crawlers ask for
 * `/robots.txt`. They are permanently redirected to the canonical `/public/*`
 * URL, so old data keeps working without duplicating assets or depending on
 * bundler asset hashing.
 *
 * The explicit list keeps the well-known assets documented (and fast); the
 * generic rule catches any other root-level asset path that data may carry.
 * Paths with a subdirectory, framework assets (`/public`, `/_client`, `/_bun`)
 * and the API are never touched, and page URLs never contain a file extension,
 * so a game detail route such as `/:id` cannot be shadowed.
 */
const ROOT_ASSET_ALIASES = [
	"/background.webp",
	"/dzmm.webp",
	"/favicon.ico",
	"/hikarinagi-icon.webp",
	"/kungal.webp",
	"/linuxdo.webp",
	"/neko.webp",
	"/No-Image-Placeholder.svg.webp",
	"/robots.txt",
	"/telegram.png",
];

/** `/file.ext` at the site root, excluding framework and API prefixes. */
const ROOT_ASSET_PATH =
	/^\/(?!public\/|_client\/|_bun\/|_furin\/|api\/)[^/]+\.(?:webp|png|jpe?g|gif|svg|ico|txt|xml|woff2?)$/;

function redirectToPublic(path: string, request: Request): Response {
	return Response.redirect(new URL("/public" + path, request.url), 301);
}

let publicApi = new Elysia().onRequest(({ request }) => {
	const pathname = new URL(request.url).pathname;
	if (ROOT_ASSET_PATH.test(pathname)) return redirectToPublic(pathname, request);
	return undefined;
});

for (const path of ROOT_ASSET_ALIASES) {
	publicApi = publicApi.get(path, {}, ({ request }) =>
		redirectToPublic(path, request),
	);
}

export { publicApi };
