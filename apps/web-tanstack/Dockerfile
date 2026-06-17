FROM oven/bun:slim AS build

WORKDIR /app

COPY package.json package.json
COPY apps/web-tanstack/package.json apps/web-tanstack/package.json
COPY packages/libs/package.json packages/libs/package.json
COPY packages/config/package.json packages/config/package.json

RUN bun install

COPY apps/web-tanstack apps/web-tanstack
COPY apps/api apps/api
COPY packages packages

ENV NODE_ENV=production

WORKDIR /app/apps/web-tanstack
RUN bun install
RUN bun run build
RUN bun run build:executables
RUN ls -la /app/apps/web-tanstack/   # 调试
FROM gcr.io/distroless/base
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/apps/web-tanstack/server /app/server

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["./server"]
