FROM oven/bun:slim AS build

WORKDIR /app

COPY package.json ./
COPY apps/web-tanstack/package.json apps/web-tanstack/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/libs/package.json packages/libs/package.json
COPY packages/config/package.json packages/config/package.json

RUN bun install

COPY apps/web-tanstack apps/web-tanstack
COPY apps/api apps/api
COPY packages packages

ENV NODE_ENV=production

WORKDIR /app/apps/web-tanstack
RUN bun --bun run build

FROM oven/bun:slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/apps/web-tanstack/dist ./dist
COPY --from=build /app/apps/web-tanstack/server-ultra.ts ./

USER bun

ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["bun", "--bun", "run", "server-ultra.ts"]
