# 生产镜像：Nitro（bun preset）产物 + 内嵌静态资源 → 单文件可执行程序。
#
# 构建阶段用 Bun 安装依赖并构建：`bun run build` 产出 .output/，
# `bun run build:binary` 再用 bun build --compile 编成 .output/server-bin
# （.output/public/** 全部内嵌）。运行阶段只有 Chainguard glibc-dynamic + 二进制：
# 没有 Bun 运行时、没有 node_modules、没有 public 目录。
#
# 运行期密钥绝不写入镜像，只通过部署平台注入；构建期公开变量只有 BUILD_ID。
ARG BUILD_ID=dev

FROM oven/bun:1.4.4-slim AS build

WORKDIR /app

# 依赖元数据 + 仓库锁文件：先于源码拷贝，只有依赖变更时才失效层缓存
COPY package.json bun.lock ./
COPY apps/web-tanstack/package.json apps/web-tanstack/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/libs/package.json packages/libs/package.json
COPY packages/config/package.json packages/config/package.json
COPY scripts scripts
RUN bun install --frozen-lockfile

# 构建期防线：react / react-dom 版本不一致或存在多个副本时直接失败
RUN bun scripts/check-react-versions.ts

COPY apps/web-tanstack apps/web-tanstack
COPY apps/api apps/api
COPY packages packages

# BUILD_ID 在 FROM 之前声明后不会自动进入本阶段作用域，必须重新声明。
# 它会被打进客户端与服务端 bundle（virtual:build-id）：页面 __BUILD_ID__ 与
# /_build 都取这个构建期常量；漏传时 vite 用 dev-<随机> 兜底，两侧仍一致。
ARG BUILD_ID
ENV NODE_ENV=production
ENV BUILD_ID=${BUILD_ID}

WORKDIR /app/apps/web-tanstack
RUN bun run build
RUN bun run build:binary

# 运行阶段：Chainguard glibc-dynamic（Wolfi 基础镜像，glibc + libgcc/libstdc++ +
# ca-certificates，无 shell / 无包管理器），只有二进制。默认非 root（65532:65532）
# 运行。需要可复现构建时可把 FROM 固定到 digest，例如
#   FROM cgr.dev/chainguard/glibc-dynamic@sha256:...
FROM cgr.dev/chainguard/glibc-dynamic:latest

WORKDIR /app

ENV NODE_ENV=production
# 运行期 BUILD_ID 只用于启动日志；/_build 用的是构建期常量，二者同源（同一 build-arg）。
ARG BUILD_ID=dev
ENV BUILD_ID=${BUILD_ID}
ENV HOST=0.0.0.0
ENV PORT=3000

# 单文件二进制：Nitro 服务端 + 全部静态资源都在这一个文件里
COPY --from=build --chown=65532:65532 /app/apps/web-tanstack/.output/server-bin /app/server

USER 65532:65532

# 运行镜像里没有 curl/wget：二进制自带健康检查（请求本机 /api/health）。
# 兼容两种拼写：本文件用 --healthcheck；Dokploy 上该服务的既有配置是
# ["CMD","/app/server","healthcheck"]（无前导 --），入口也认，避免被误判 unhealthy。
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["/app/server", "--healthcheck"]

EXPOSE 3000
ENTRYPOINT ["/app/server"]
