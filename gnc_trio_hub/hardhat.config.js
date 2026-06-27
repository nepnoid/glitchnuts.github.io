import { config as loadEnv } from 'dotenv';
import '@nomicfoundation/hardhat-toolbox';

loadEnv();

const GNC_RPC_URL = process.env.GNC_RPC_URL || 'http://127.0.0.1:9650/ext/bc/REPLACE_WITH_GNC_BLOCKCHAIN_ID/rpc';
const GNC_CHAIN_ID = Number(process.env.GNC_CHAIN_ID || '0');
const GNC_PRIVATE_KEY = process.env.GNC_PRIVATE_KEY || process.env.GNC_DEPLOYER_PRIVATE_KEY || '';

const accounts = GNC_PRIVATE_KEY ? [GNC_PRIVATE_KEY] : [];

export default {
  solidity: '0.8.24',
  networks: {
    gnc: {
      url: GNC_RPC_URL,
      chainId: GNC_CHAIN_ID || undefined,
      accounts
    }
  }
};
