FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/backend/node_modules ./backend/node_modules
RUN npm --prefix backend run build

FROM node:22-alpine AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/backend/dist ./dist
EXPOSE 4013
CMD ["npm", "run", "start"]
