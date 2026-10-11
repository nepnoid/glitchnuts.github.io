const config = require('../config/runtime.cjs');
const rpcClient = require('../clients/gncRpcClient.cjs');

async function getNetworkStatus() {
  const blockHeight = await rpcClient.getBlockNumber();
  return {
    status: 'connected',
    chainId: config.gnc.chainId,
    networkId: config.gnc.networkName,
    blockHeight,
    explorerUrl: config.gnc.explorerUrl,
    source: 'rpc',
    settlementMode: config.gnc.settlementMode,
    checkedAt: new Date().toISOString(),
  };
}

function hexToDecimalString(value) {
  return value ? BigInt(value).toString(10) : '0';
}

async function getWalletBalance(address) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error('valid EVM wallet address is required');
  const rawBalance = await rpcClient.getBalance(address);
  return { address, rawBalance, balanceBaseUnits: hexToDecimalString(rawBalance), source: 'rpc', checkedAt: new Date().toISOString() };
}

module.exports = { getNetworkStatus, getWalletBalance };
