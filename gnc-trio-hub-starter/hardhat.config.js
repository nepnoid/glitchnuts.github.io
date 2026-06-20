require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: '0.8.24',
  defaultNetwork: 'local',
  networks: {
    local: {
      url: process.env.RPC_URL || 'http://127.0.0.1:8545',
      chainId: Number(process.env.CHAIN_ID || 31337),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  }
};
