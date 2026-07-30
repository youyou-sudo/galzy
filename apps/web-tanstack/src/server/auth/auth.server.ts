import { getRequestHeader } from "@tanstack/react-start/server";
import { createAuthClient } from "better-auth/client";
import { betterPlugins } from "./betterPlugins";

const BETTER_AUTH_URL = process.env.API_HOST || "http://localhost:3001";
const BETTER_AUTH_BASE_PATH = "/auth";
const BETTER_AUTH_COOKIE_PREFIX = "better-auth";

const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 30_000);

// Wraps fetch with timeout + network error catching, converting errors to
// structured Responses so Better Auth's client pipeline can handle them
// gracefully instead of throwing raw errors that crash SSR.
const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal =
    init?.signal && 'any' in AbortSignal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
  try {
    return await fetch(input, { ...init, signal });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ message: `Auth backend unreachable: ${detail}` }),
      {
        status: 502,
        headers: { 'content-type': 'application/json' },
      },
    );
  }
};

export const authServerClient = createAuthClient({
  plugins: betterPlugins,
  baseURL: BETTER_AUTH_URL,
  basePath: BETTER_AUTH_BASE_PATH,
  fetchOptions: {
    baseURL: BETTER_AUTH_URL + BETTER_AUTH_BASE_PATH,
    customFetchImpl: safeFetch as typeof fetch,
    onRequest: async (context) => {
      const cookie = await getRequestHeader("Cookie");

      if (cookie) {
        const cookiePattern = new RegExp(
          `(^|; )(${BETTER_AUTH_COOKIE_PREFIX}\\.[^ ;]+|__Secure-${BETTER_AUTH_COOKIE_PREFIX}\\.[^ ;]+)`,
          "g",
        );
        const matches = cookie.match(cookiePattern);

        if (matches) {
          const authCookies = matches
            .map((m) => m.replace(/^; /, ""))
            .join("; ");

          context.headers.set("Cookie", authCookies);
        }
      }
    },
  },
});
