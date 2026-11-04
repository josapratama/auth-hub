# Multi-stage Dockerfile for Auth Hub (SSO & IAM Engine)
FROM node:20-alpine AS builder

WORKDIR /app

# Build Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Build Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/
RUN cd backend && npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4100

COPY backend/package*.json ./
RUN npm install --only=production

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/frontend/dist ../frontend/dist
COPY bin/ ./bin/

VOLUME ["/app/data"]
EXPOSE 4100

CMD ["node", "dist/index.js"]

