FROM node:22-alpine
WORKDIR /app

# 使用清华 Alpine 镜像加速
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories

# better-sqlite3 需要编译工具链
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com/ && npm ci --omit=dev
RUN apk del python3 make g++

COPY src/ ./src/

ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/index.js"]
