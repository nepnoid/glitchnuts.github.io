from pathlib import Path
root=Path(__file__).resolve().parents[1]
text='''# Deploy only after bootstrap, secret setup, and resource approval.
services:
'''
for n in range(1,5):
 text+=f'''  validator{n}:
    build: ./chain
    restart: unless-stopped
    environment:
      GNC_NODE_INDEX: "{n}"
      GNC_GENESIS_FILE: /run/gnc/genesis.json
      GNC_NODE_KEY_FILE: /run/gnc/key
      GNC_STATIC_NODES_FILE: /run/gnc/static-nodes.json
      RPC_HOST: "{'0.0.0.0' if n==1 else '127.0.0.1'}"
      JAVA_OPTS: "-Xms256m -Xmx768m"
    volumes:
      - ./state/genesis.json:/run/gnc/genesis.json:ro
      - ./state/node-{n}/key:/run/gnc/key:ro
      - ./state/node-{n}/static-nodes.json:/run/gnc/static-nodes.json:ro
      - validator{n}-data:/var/lib/besu/data
    networks: [chain]
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
    mem_limit: 1536m
    pids_limit: 256
'''
text+='''  api:
    build:
      context: ..
      dockerfile: public-beta/Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      RPC_UPSTREAM: http://validator1:8545
      DEPLOYMENT_FILE: /state/deployment.json
      FAUCET_KEY_FILE: /secrets/faucet.key
      TURNSTILE_SECRET_FILE: /secrets/turnstile.secret
      IP_HASH_SALT_FILE: /secrets/ip-salt
      CLAIM_DB: /claims/claims.sqlite
      TRUSTED_PROXY_CIDR: 10.77.0.2/32
      PORT: "8080"
    volumes:
      - ./state/deployment.json:/state/deployment.json:ro
      - ./state/faucet.key:/secrets/faucet.key:ro
      - ./state/turnstile.secret:/secrets/turnstile.secret:ro
      - ./state/ip-salt:/secrets/ip-salt:ro
      - claims-data:/claims
    depends_on: [validator1, validator2, validator3, validator4]
    networks:
      chain: {}
      edge:
        ipv4_address: 10.77.0.3
      api-outbound: {}
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
    mem_limit: 512m
    pids_limit: 128
  edge:
    image: caddy:2.10.2-alpine
    restart: unless-stopped
    environment:
      BETA_DOMAIN: ${BETA_DOMAIN:?Set BETA_DOMAIN}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      edge:
        ipv4_address: 10.77.0.2
      tls-outbound: {}
    mem_limit: 256m
    pids_limit: 128
networks:
  chain:
    internal: true
  edge:
    internal: true
    ipam:
      config:
        - subnet: 10.77.0.0/24
  api-outbound: {}
  tls-outbound: {}
volumes:
  validator1-data: {}
  validator2-data: {}
  validator3-data: {}
  validator4-data: {}
  claims-data: {}
  caddy-data: {}
  caddy-config: {}
'''
(root/'compose.yml').write_text(text)
