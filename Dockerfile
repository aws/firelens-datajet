
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

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
COPY ./clients ./clients

COPY ./app.ts ./app.ts

RUN npm run build

RUN npm prune --production # Remove dev dependencies

# ---------- Release ----------
FROM base AS release

COPY ./data/data-public ./data/data-public
COPY ./firelens-datajet.json ./firelens-datajet.json

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

COPY package.json ./

USER node

CMD ["node", "./dist/app.js"]