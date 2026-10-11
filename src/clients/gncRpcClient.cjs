const config = require('../config/runtime.cjs');

async function rpcCall(method, params = []) {
  if (!config.gnc.rpcHttpUrl) throw new Error('GNC_RPC_HTTP_URL is not configured');
  const response = await fetch(config.gnc.rpcHttpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`RPC request failed with status ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'Unknown RPC error');
  return payload.result;
}

async function getBlockNumber() {
  const hex = await rpcCall('eth_blockNumber');
  return Number.parseInt(hex, 16);
}

async function getBalance(address, blockTag = 'latest') {
  return rpcCall('eth_getBalance', [address, blockTag]);
}

module.exports = { rpcCall, getBlockNumber, getBalance };
