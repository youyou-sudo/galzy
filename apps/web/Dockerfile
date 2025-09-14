FROM node:22-slim AS build

WORKDIR /app

# https://pnpm.io/installation#in-a-docker-container
RUN npm install -g bun

# Cache packages
COPY package.json package.json

COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/libs/package.json packages/libs/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json

RUN bun install

COPY apps/web apps/web
COPY apps/api apps/api
COPY packages/libs packages/libs
COPY packages/config packages/config

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN bun run build

# -----------
FROM node:22-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone .

RUN chown nextjs:nodejs apps

USER nextjs

ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
