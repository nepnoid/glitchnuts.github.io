FROM node:22.13.0-bookworm-slim
WORKDIR /app
COPY public-beta/package.json public-beta/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && mkdir /claims && chown node:node /claims
COPY --chown=node:node public-beta/ ./
COPY --chown=node:node contracts/GNC.sol /contracts/GNC.sol
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node","server.mjs"]
