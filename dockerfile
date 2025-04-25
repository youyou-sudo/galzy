# 使用指定版本的 Node 镜像作为基础
FROM node:20-slim as base
WORKDIR /usr/src/app

# 安装 pnpm
RUN npm install --global corepack@latest && corepack enable pnpm

# 安装依赖到临时目录以优化缓存
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json pnpm-lock.yaml /temp/dev/
WORKDIR /temp/dev
RUN pnpm install
RUN pnpm approve-builds

# 构建阶段
FROM base AS build
COPY --from=install /temp/dev/node_modules ./node_modules
COPY . .
RUN apt-get update -y && apt-get install -y openssl
RUN pnpm build

# 生产环境镜像
FROM base AS production
WORKDIR /usr/src/app

COPY --from=build /usr/src/app/.next/standalone ./ 
COPY --from=build /usr/src/app/public ./public
COPY --from=build /usr/src/app/.next/static ./.next/static
COPY --from=build /usr/src/app/worker ./worker
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/start.sh ./start.sh

# 设置环境变量和权限
ENV NODE_ENV=production
RUN chmod +x start.sh && chown -R node:node /usr/src/app
USER node
RUN mkdir -p /usr/src/app/.next/cache && chown -R node:node /usr/src/app/.next

EXPOSE 3000
CMD ["./start.sh"]
