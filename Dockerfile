# ---------- Base ----------
FROM node:14-alpine AS base

WORKDIR /app

# ---------- Builder ----------
# Creates:
# - node_modules: production dependencies (no dev dependencies)
# - dist: A production build compiled with typescript
FROM base AS builder

COPY package*.json tsconfig.json ./

RUN npm install

COPY ./core ./core
COPY ./datajets ./datajets
COPY ./filters ./filters
COPY ./generators ./generators

COPY ./driver.ts ./driver.ts

RUN npm run build

RUN npm prune --production # Remove dev dependencies

# ---------- Release ----------
FROM base AS release

COPY ./data ./data
COPY ./firelens-datajet.json ./firelens-datajet.json

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node

CMD ["node", "./dist/driver.js"]