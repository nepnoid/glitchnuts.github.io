const config = {
  port: Number(process.env.PORT || 5000),
  jwtSecret: process.env.JWT_SECRET || '',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/gnc_ecosystem',
  gnc: {
    chainId: Number(process.env.GNC_CHAIN_ID || 35001),
    networkName: process.env.GNC_NETWORK_NAME || 'gnc-testnet',
    rpcHttpUrl: process.env.GNC_RPC_HTTP_URL || '',
    explorerUrl: process.env.GNC_EXPLORER_URL || '',
    networkStatusSource: process.env.GNC_NETWORK_STATUS_SOURCE || 'rpc',
    balanceSource: process.env.GNC_BALANCE_SOURCE || 'rpc',
    settlementMode: process.env.GNC_SETTLEMENT_MODE || 'read_only',
  },
};

module.exports = config;
