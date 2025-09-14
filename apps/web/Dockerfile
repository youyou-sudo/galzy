# 使用官方 Node.js 镜像作为构建环境
FROM node:16-alpine AS build

WORKDIR /app

# 缓存依赖项
COPY package*.json ./

RUN npm install -g pnpm && pnpm install

# 复制项目文件
COPY apps/web/ .
COPY apps/api/ .
COPY packages/libs/ .
COPY packages/config/ .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 构建 Next.js 项目
WORKDIR /app/apps/web
RUN pnpm run build

# -----------
FROM node:16-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建一个系统用户来运行应用
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 自动利用构建时的输出文件，减小镜像体积
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone .

# 设置正确的权限
RUN chown nextjs:nodejs /app

USER nextjs

ENV HOSTNAME="0.0.0.0"

EXPOSE 3000
CMD ["node", "apps/web/server.js"]

