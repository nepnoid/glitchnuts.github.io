FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY gnc_server.cjs ./
COPY src ./src

USER node
EXPOSE 5000

CMD ["node", "gnc_server.cjs"]
