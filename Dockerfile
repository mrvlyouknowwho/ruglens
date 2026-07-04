FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY bot.mjs store.mjs resolve.mjs report.mjs evm-analyzer.mjs ton-analyzer.mjs sol-analyzer.mjs ./
ENV NODE_ENV=production DATA_DIR=/data
VOLUME /data
CMD ["node", "bot.mjs"]
