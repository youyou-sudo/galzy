FROM oven/bun:slim AS build

WORKDIR /app

COPY package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/libs/package.json packages/libs/package.json
COPY packages/config/package.json packages/config/package.json

RUN bun install

COPY apps/web apps/web
COPY apps/api apps/api
COPY packages/libs packages/libs
COPY packages/config packages/config

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN bun --bun run build

FROM oven/bun:slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/apps/web/.next/standalone ./

USER bun

ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["bun", "run", "apps/web/server.js"]
