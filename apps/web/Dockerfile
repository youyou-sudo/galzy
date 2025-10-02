# --- 构建阶段 ---
FROM node:20-slim AS build

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 只复制 package.json 文件（不复制 bun.lock）
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/libs/package.json packages/libs/package.json
COPY packages/config/package.json packages/config/package.json

# 安装依赖
RUN pnpm install --frozen-lockfile=false

# 复制项目代码
COPY apps/web apps/web
COPY apps/api apps/api
COPY packages/libs packages/libs
COPY packages/config packages/config

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN pnpm run build

# --- 生产阶段 ---
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 复制构建好的 standalone 输出
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone .

USER nextjs

ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

# 用 node 启动（Next.js standalone 默认）
CMD ["node", "server.js"]
