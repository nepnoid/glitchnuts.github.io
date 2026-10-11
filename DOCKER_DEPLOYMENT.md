# GNC backend Docker deployment

The stack contains the Express GNC API and MongoDB. It starts in `read_only` settlement mode: the API can read RPC network state and wallet balances, but it does not sign or submit transactions.

## 1. Copy the repository to a persistent server

Use a VPS, Cloud Computer, or another always-on Docker host. GitHub Pages cannot run the backend itself.

```bash
git clone https://github.com/nepnoid/glitchnuts.github.io.git
cd glitchnuts.github.io
cp .env.example .env
chmod 600 .env
```

## 2. Fill the server-only environment file

Edit `.env` and set:

```bash
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=https://nepnoid.github.io
GNC_RPC_HTTP_URL=https://your-public-gnc-rpc-endpoint
```

Keep the RPC URL private if it contains authentication. Do not put `.env`, private keys, seed phrases, or wallet backups in GitHub.

## 3. Start the API and MongoDB

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/network/status
```

The API routes are:

- `GET /api/health`
- `GET /api/network/status`
- `GET /api/wallets/:address/balance`
- `GET /api/board/messages`
- `POST /api/board/messages`

MongoDB persists to the `mongo-data` Docker volume. Back it up before production use.

## 4. Put HTTPS in front of the API

Do not expose port 5000 directly as the production URL. Put Nginx, Caddy, or a managed load balancer in front of it and issue a TLS certificate. The public API URL should look like:

```text
https://api.example.com
```

Set DNS for `api.example.com` to the Docker host, allow only ports 80/443 through the firewall, and keep MongoDB unexposed.

## 5. Connect GitHub Pages

Set the `gnc-board-api` meta tag in `index.html` to the public HTTPS API origin:

```html
<meta name="gnc-board-api" content="https://api.example.com">
```

After publishing, the casino will use `/api/network/status` for the live RPC badge and the `/api/board/messages` endpoints for the shared board.

## Production checks

Before enabling any real settlement, verify RPC chain ID, block height, wallet balance reads, CORS, rate limits, backups, logs, and signer isolation. Keep `GNC_SETTLEMENT_MODE=read_only` until those checks are complete. Never put a treasury or faucet private key in the Docker image or Git repository.
