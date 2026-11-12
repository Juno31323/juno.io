ARG PLATFORM_URL=http://127.0.0.1:4400
FROM node:24-bookworm-slim AS build
ARG PLATFORM_URL
ENV PLATFORM_URL=$PLATFORM_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run platform:build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/platform/dist ./platform/dist
USER node
EXPOSE 8080
CMD ["node", "platform/dist/server/entry.mjs"]
