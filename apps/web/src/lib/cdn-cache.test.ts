import { describe, expect, it } from "vitest";
import {
	applyCdnCacheHeaders,
	cdnCacheRuleFor,
	isCdnBypassed,
} from "./cdn-cache";

function request(path: string, init?: RequestInit): Request {
	return new Request(`https://galzy.moe${path}`, init);
}

function htmlResponse(headers: Record<string, string> = {}): Response {
	return new Response("<!doctype html><html></html>", {
		status: 200,
		headers: { "cache-control": "no-store", ...headers },
	});
}

describe("cdnCacheRuleFor", () => {
	it("caches public pages with the expected s-maxage", () => {
		expect(cdnCacheRuleFor("/")?.sMaxAge).toBe(60);
		expect(cdnCacheRuleFor("/games")?.sMaxAge).toBe(60);
		expect(cdnCacheRuleFor("/v123")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/v123/introduction")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/v123/introduction/42")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/v123/relations")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/v123/translate")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/v123/characters")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/tags/category/theme")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/tags/123")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/collections/12")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/producer/p1")?.sMaxAge).toBe(300);
		expect(cdnCacheRuleFor("/topics/42")?.sMaxAge).toBe(120);
		expect(cdnCacheRuleFor("/contact")?.sMaxAge).toBe(3600);
	});

	it("never caches realtime or personalized pages", () => {
		expect(cdnCacheRuleFor("/v123/comment")).toBeNull();
		expect(cdnCacheRuleFor("/admin")).toBeNull();
		expect(cdnCacheRuleFor("/admin/comments")).toBeNull();
		expect(cdnCacheRuleFor("/user")).toBeNull();
		expect(cdnCacheRuleFor("/auth/login")).toBeNull();
		expect(cdnCacheRuleFor("/topics/create")).toBeNull();
		expect(cdnCacheRuleFor("/topics/42/edit")).toBeNull();
		expect(cdnCacheRuleFor("/introduction/create")).toBeNull();
		expect(cdnCacheRuleFor("/api/search")).toBeNull();
		expect(cdnCacheRuleFor("/_furin/sync")).toBeNull();
		expect(cdnCacheRuleFor("/error")).toBeNull();
	});

	it("treats trailing slashes like the canonical path", () => {
		expect(cdnCacheRuleFor("/games/")?.sMaxAge).toBe(60);
		expect(cdnCacheRuleFor("/v123/comment/")).toBeNull();
	});
});

describe("isCdnBypassed", () => {
	it("bypasses api and personalized prefixes", () => {
		expect(isCdnBypassed("/api/search")).toBe(true);
		expect(isCdnBypassed("/admin/users")).toBe(true);
		expect(isCdnBypassed("/user")).toBe(true);
		expect(isCdnBypassed("/auth/login")).toBe(true);
		expect(isCdnBypassed("/v123/comment")).toBe(true);
		expect(isCdnBypassed("/v123")).toBe(false);
	});
});

describe("applyCdnCacheHeaders", () => {
	it("rewrites no-store to a CDN-cacheable header on public documents", () => {
		const out = applyCdnCacheHeaders(request("/v123"), htmlResponse());
		expect(out.headers.get("cache-control")).toBe(
			"public, max-age=0, s-maxage=300, stale-while-revalidate=300",
		);
		expect(out.headers.get("cdn-cache-control")).toBe("max-age=300");
	});

	it("leaves realtime pages on no-store", () => {
		const out = applyCdnCacheHeaders(request("/v123/comment"), htmlResponse());
		expect(out.headers.get("cache-control")).toBe("no-store");
	});

	it("does not touch client-navigation data requests", () => {
		const out = applyCdnCacheHeaders(
			request("/v123?_furin=data"),
			htmlResponse(),
		);
		expect(out.headers.get("cache-control")).toBe("no-store");
	});

	it("does not cache responses that set cookies", () => {
		const out = applyCdnCacheHeaders(
			request("/"),
			htmlResponse({ "set-cookie": "session=abc; Path=/" }),
		);
		expect(out.headers.get("cache-control")).toBe("no-store");
	});

	it("only rewrites successful GET/HEAD document responses", () => {
		const post = applyCdnCacheHeaders(
			request("/v123", { method: "POST" }),
			htmlResponse(),
		);
		expect(post.headers.get("cache-control")).toBe("no-store");

		const notFound = applyCdnCacheHeaders(
			request("/v123"),
			new Response("not found", { status: 404 }),
		);
		expect(notFound.status).toBe(404);
		expect(notFound.headers.get("cache-control")).toBeNull();
	});
});
