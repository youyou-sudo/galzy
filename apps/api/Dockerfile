# Build stage
FROM oven/bun:1.3.5 AS build

WORKDIR /app

# Cache packages
COPY package.json package.json
COPY bun.lock bun.lock

COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json

RUN bun install

COPY apps/api apps/api
COPY packages/config packages/config

# Debug step: List files in the apps/api folder
RUN ls -al /app/apps/api

ENV NODE_ENV=production

WORKDIR /app/apps/api
RUN bun run build

# Debug step: List files after build to check if 'server' is generated
RUN ls -al /app/apps/api
# Production stage
FROM gcr.io/distroless/base

WORKDIR /app

# Copy server file from build stage
COPY --from=build /app/apps/api/server /app/server

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV OTEL=false

# Default command
CMD ["./server"]

EXPOSE 3001
