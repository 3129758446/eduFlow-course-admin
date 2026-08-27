FROM node:22-alpine AS deps
WORKDIR /app

# deps 阶段保留编译工具，仅用于安装开发依赖中的 SQLite 迁移工具。
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com/ && npm ci

FROM node:22-alpine AS builder
WORKDIR /app

# builder 阶段保留 devDependencies，用 Nest CLI 编译 TypeScript 到 dist。
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com/ && npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENV PORT=3000
ENV DATA_ROOT=/app/data
ENV SERVE_STATIC=false
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
