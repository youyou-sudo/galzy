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

# Production stage
FROM gcr.io/distroless/base

WORKDIR /app

# Copy server file from build stage
COPY --from=build /app/apps/web-tanstack/server /app/server

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV OTEL=false

# Default command
CMD ["./server"]

EXPOSE 3000
