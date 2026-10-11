#!/bin/sh
set -eu

NODE_INDEX=${GNC_NODE_INDEX:?GNC_NODE_INDEX (1..4) is required}
GENESIS_FILE=${GNC_GENESIS_FILE:-/run/gnc/genesis.json}
NODE_KEY_FILE=${GNC_NODE_KEY_FILE:-/run/gnc/key}
STATIC_NODES_FILE=${GNC_STATIC_NODES_FILE:-/run/gnc/static-nodes.json}
P2P_PORT=${P2P_PORT:-30303}
RPC_PORT=${RPC_PORT:-8545}
RPC_HOST=${RPC_HOST:-127.0.0.1}

case "$NODE_INDEX" in 1|2|3|4) ;; *) echo 'GNC_NODE_INDEX must be 1, 2, 3, or 4' >&2; exit 64 ;; esac
[ -f "$GENESIS_FILE" ] || { echo "missing genesis mount; run bootstrap first" >&2; exit 66; }
[ -f "$NODE_KEY_FILE" ] || { echo "missing validator node-key mount" >&2; exit 66; }
[ -f "$STATIC_NODES_FILE" ] || { echo "missing static-nodes mount" >&2; exit 66; }

# No ADMIN/QBFT/DEBUG/TRACE endpoints. ETH, NET, WEB3 are the only RPC namespaces.
# Compose must publish no ports and attach all validators only to an internal Docker network.
exec /opt/besu/bin/besu \
  --data-path="/var/lib/besu/data" \
  --genesis-file="$GENESIS_FILE" \
  --node-private-key-file="$NODE_KEY_FILE" \
  --static-nodes-file="$STATIC_NODES_FILE" \
  --p2p-host=0.0.0.0 \
  --p2p-port="$P2P_PORT" \
  --discovery-enabled=false \
  --rpc-http-enabled=true \
  --rpc-http-host="$RPC_HOST" \
  --rpc-http-port="$RPC_PORT" \
  --rpc-http-api=ETH,NET,WEB3 \
  --host-allowlist=localhost,127.0.0.1,validator1 \
  --rpc-http-cors-origins=none \
  --rpc-http-max-active-connections=32 \
  --min-gas-price=0 \
  --logging=INFO
