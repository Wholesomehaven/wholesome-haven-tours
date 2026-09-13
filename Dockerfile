FROM node:22-bookworm-slim

WORKDIR /app

# Build tools live in devDependencies. Keep NODE_ENV unset until after `npm run build`.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NITRO_PRESET=node-server \
    RAILWAY_ENVIRONMENT=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_LEGACY_PEER_DEPS=true

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "run", "start"]
