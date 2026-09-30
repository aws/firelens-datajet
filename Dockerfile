
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# ---------- Base ----------
FROM public.ecr.aws/docker/library/node:current-alpine AS base

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
COPY ./wrappers ./wrappers

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

# npm and Node's C headers (bundled OpenSSL) are not needed at runtime
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/include/node

USER node

CMD ["node", "./dist/app.js"]