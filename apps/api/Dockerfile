# Build stage
FROM oven/bun:canary-slim AS build

WORKDIR /app

# Cache packages
COPY package.json package.json

COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json

# postinstall（patch-bun-queue）所需脚本。首次 install 用 --ignore-scripts：
# 此时 apps/api 源码尚未 COPY、node_modules 布局未建立，postinstall 无意义；
# 源码 COPY 后的第二次 install 会正常触发 postinstall 完成 patch。
COPY scripts scripts

RUN bun install --ignore-scripts

COPY apps/api apps/api
COPY packages/config packages/config

# Debug step: List files in the apps/api folder
RUN ls -al /app/apps/api

ENV NODE_ENV=production

WORKDIR /app/apps/api
RUN bun install
RUN bun run build

# Debug step: List files after build to check if 'server' is generated
RUN ls -al /app/apps/api
# Production stage
FROM gcr.io/distroless/base

WORKDIR /app

# Copy server file from build stage
COPY --from=build /app/apps/api/server /app/server

# 启动时自动应用挂起的数据库迁移（db/migrate.ts 的 dbAction 按 cwd 定位 drizzle 目录）。
# 全新数据库部署必须包含该目录，否则服务以 error 状态启动、cron 不会开启。
COPY --from=build /app/apps/api/drizzle /app/drizzle

# bun-queue 的 Lua 命令脚本（dist/commands/*.lua）。单二进制编译后 import.meta.dir
# 指向虚拟 $bunfs，脚本文件不会被嵌入；postinstall 已把路径 patch 为
# process.cwd()/commands，server 运行时 cwd=/app，因此必须把脚本复制到 /app/commands。
COPY --from=build /app/apps/api/commands /app/commands

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV OTEL=false

# Default command
CMD ["./server"]

EXPOSE 3001
