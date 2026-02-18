FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER nobody
EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=10s --retries=1 --start-period=30s \
  CMD ["bun", "run", "src/health-check.ts"]

ENTRYPOINT ["bun", "run", "src/index.ts"]
