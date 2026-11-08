FROM node:24-bookworm-slim
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/services/embeddingService.js ./services/embeddingService.js
RUN node -e "require('./services/embeddingService').createEmbedding('Build-time model verification').then(v=>{if(v.length!==384)process.exit(1)})"
COPY backend/ ./
COPY dummy-environment/js/demo-programmes.js /app/dummy-environment/js/demo-programmes.js
RUN mkdir -p data/documents/uploads && chown -R node:node /app/backend/data
ENV NODE_ENV=production VECTOR_BACKEND=database WARM_MODEL_ON_START=yes
USER node
EXPOSE 10000
CMD ["node","server.js"]
