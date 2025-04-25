# -------- 通用基础镜像，安装 OpenSSL --------
    FROM oven/bun:slim as base
    RUN apt-get update && apt-get install -y openssl libssl-dev
    WORKDIR /usr/src/app
    
    # -------- 安装依赖到临时目录以优化缓存 --------
    FROM base AS install
    RUN mkdir -p /temp/dev
    COPY package.json bun.lock /temp/dev/
    RUN cd /temp/dev && bun install --frozen-lockfile
    
    # -------- 构建阶段 --------
    FROM base AS build
    COPY --from=install /temp/dev/node_modules ./node_modules
    COPY . .
    
    # Prisma Client 生成
    RUN bunx prisma generate
    
    # 构建项目
    RUN bun run build
    
    # 设置权限给 bun 用户（distroless 无法再设置）
    RUN chmod +x start.sh && chown -R bun:bun /usr/src/app
    
    # -------- 生产镜像，使用最小化的 distroless --------
    FROM oven/bun:distroless AS production
    WORKDIR /usr/src/app
    
    COPY --from=build /usr/src/app/.next/standalone ./
    COPY --from=build /usr/src/app/public ./public
    COPY --from=build /usr/src/app/.next/static ./.next/static
    COPY --from=build /usr/src/app/worker ./worker
    COPY --from=build /usr/src/app/prisma ./prisma
    COPY --from=build /usr/src/app/start.sh ./start.sh
    
    USER bun
    EXPOSE 3000
    CMD ["./start.sh"]
    