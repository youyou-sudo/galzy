ARG BUILD_ID=dev

# 钉住与根 package.json packageManager 一致的 bun 版本（1.3.14）。
# canary/浮动 tag 的解析结果与仓库 bun.lock 不兼容，会触发
# `bun install --frozen-lockfile` 报 "lockfile had changes"。
FROM oven/bun:1.3.14-slim AS build

WORKDIR /app

# 依赖元数据 + 仓库锁文件：先于源码拷贝，只有依赖变更时才失效层缓存
COPY package.json bun.lock ./
COPY apps/web-tanstack/package.json apps/web-tanstack/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/libs/package.json packages/libs/package.json
COPY packages/config/package.json packages/config/package.json
COPY scripts scripts

# 使用仓库 bun.lock 锁定安装。此前镜像内没有 bun.lock、两次浮动解析
# `^19.2.8`，react 与 react-dom 被安装成不同版本，运行时 react-dom 的
# 版本一致性检查直接抛错（Incompatible React versions），页面由幸存的
# 副本渲染、日志被每次请求刷屏。
RUN bun install --frozen-lockfile

# 构建期防线：react / react-dom 版本不一致或存在多个副本时直接失败
RUN bun scripts/check-react-versions.ts

COPY apps/web-tanstack apps/web-tanstack
COPY apps/api apps/api
COPY packages packages

ENV NODE_ENV=production
ENV BUILD_ID=${BUILD_ID}

WORKDIR /app/apps/web-tanstack
RUN bun run build
RUN bun run build:executables
RUN ls -la /app/apps/web-tanstack/   # 调试
FROM gcr.io/distroless/base
WORKDIR /app

ENV NODE_ENV=production
ENV BUILD_ID=${BUILD_ID}

COPY --from=build /app/apps/web-tanstack/server /app/server

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

CMD ["./server"]
