FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Semua dependency (termasuk devDependencies) dibutuhkan untuk build TypeScript & Prisma
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

# Image produksi: hanya hasil build + dependency produksi
FROM base AS runner
ENV NODE_ENV=production PORT=3001

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

RUN mkdir -p /app/uploads /app/logs && chown -R nodejs:nodejs /app/uploads /app/logs

USER nodejs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/app.js"]
