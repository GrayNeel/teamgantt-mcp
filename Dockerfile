# syntax=docker/dockerfile:1

# ---- build stage: install all deps and bundle ----
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies against the lockfile first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build the single ESM bundle (dist/index.js).
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build

# ---- runtime stage: production deps + bundle only ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Only production dependencies in the final image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# HTTP transport: bind all interfaces so the container is reachable, and
# default the port. TEAMGANTT_API_TOKEN is supplied at run time.
ENV HOST=0.0.0.0 \
    PORT=3000
EXPOSE 3000

# Run as the built-in non-root user shipped with the node image.
USER node

# Lightweight health check against the /healthz probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js", "--http"]
