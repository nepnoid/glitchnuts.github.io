# 🌟 Glitchnut Cryptocurrency - Production Setup Guide

Welcome to **Glitchnut**, a legitimate cryptocurrency implementation with proper cryptography, networking capabilities, and production-ready features.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 14.0.0 or higher
- **npm** 6.0.0 or higher
- **Ubuntu/Linux** (recommended) or macOS/Windows

### Installation

1. **Create project directory**:
```bash
mkdir glitchnut-node
cd glitchnut-node
```

2. **Copy the source files**:
   - `glitchnut-core.js` - Core blockchain implementation
   - `glitchnut-api.js` - REST API server
   - `glitchnut-cli.js` - Command line interface
   - `package.json` - Dependencies and scripts

3. **Install dependencies**:
```bash
npm install
```

4. **Make CLI executable**:
```bash
chmod +x glitchnut-cli.js
npm link  # Optional: makes 'glitchnut' command available globally
```

## 🎯 Core Features

### ✅ Production-Ready Features
- **Real SHA-256 Cryptography** - No simulation, real crypto functions
- **Digital Signatures** - Proper transaction signing with secp256k1
- **Proof of Work Mining** - Adjustable difficulty with real mining
- **Merkle Trees** - Transaction integrity verification
- **Wallet Management** - Secure key generation and storage
- **REST API** - Full HTTP API with WebSocket support
- **CLI Interface** - Professional command-line tools
- **Data Persistence** - Blockchain and wallet storage
- **Transaction Fees** - Economic incentive system
- **Difficulty Adjustment** - Automatic network difficulty balancing

### 🔧 Technical Specifications
- **Block Time**: 60 seconds (adjustable)
- **Mining Reward**: 50 GNC (configurable)
- **Max Transactions per Block**: 10 (configurable)
- **Difficulty Adjustment**: Every 10 blocks
- **Address Format**: GNC + RIPEMD160(SHA256(publicKey))
- **Signature Algorithm**: ECDSA with secp256k1

## 💻 Usage

### Option 1: Interactive Mode (Recommended for beginners)
```bash
npm start
# or
node glitchnut-cli.js start
```

This opens an interactive menu where you can:
- View blockchain statistics
- Mine blocks
- Send transactions
- Start API server
- Manage wallets

### Option 2: Command Line Interface

#### Initialize blockchain:
```bash
node glitchnut-cli.js init
```

#### Start API server:
```bash
npm run api
# or
node glitchnut-cli.js api --port 3000 --ws-port 3001
```

#### Mine a block:
```bash
npm run mine
# or
node glitchnut-cli.js mine
```

#### Check balance:
```bash
node glitchnut-cli.js balance GNC1234567890ABCDEF...
```

#### Send transaction:
```bash
node glitchnut-cli.js send GNC1234567890ABCDEF... 25.5 --fee 0.1
```

#### Create new wallet:
```bash
node glitchnut-cli.js wallet
```

#### View statistics:
```bash
node glitchnut-cli.js stats
```

## 🌐 Web Interface

After starting the API server, access the web interface at:
- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api
- **WebSocket**: ws://localhost:3001

### API Endpoints

#### Blockchain
- `GET /api/blockchain` - Get full blockchain
- `GET /api/blockchain/stats` - Get blockchain statistics
- `GET /api/blockchain/validate` - Validate blockchain integrity

#### Blocks
- `GET /api/blocks` - Get blocks (paginated)
- `GET /api/blocks/:index` - Get specific block

#### Transactions
- `GET /api/transactions/pending` - Get pending transactions
- `POST /api/transactions` - Submit new transaction

#### Wallets
- `POST /api/wallets` - Create new wallet
- `GET /api/wallets/:address/balance` - Get wallet balance
- `GET /api/wallets/:address/transactions` - Get wallet transaction history

#### Mining
- `POST /api/mine` - Start mining process

## 📁 Project Structure

```
glitchnut-node/
├── glitchnut-core.js       # Core blockchain implementation
├── glitchnut-api.js        # REST API server
├── glitchnut-cli.js        # Command line interface
├── package.json            # Dependencies and scripts
├── glitchnut-data/         # Data directory (auto-created)
│   ├── blockchain.json     # Blockchain data
│   ├── default-wallet.json # Default wallet
│   └── wallet-*.json       # Additional wallets
└── public/                 # Web interface files (optional)
```

## 🔒 Security Features

1. **Cryptographic Security**:
   - SHA-256 hashing for blocks and transactions
   - ECDSA signatures for transaction authentication
   - Secure random key generation

2. **Blockchain Integrity**:
   - Merkle tree validation
   - Block hash chain verification
   - Transaction signature verification

3. **Economic Security**:
   - Proof of Work consensus
   - Transaction fees to prevent spam
   - Mining rewards for network security

## ⚙️ Configuration

You can customize Glitchnut by modifying the initialization parameters:

```javascript
const blockchain = new Glitchnut({
  dataDir: './custom-data-dir',
  difficulty: 4,                    // Mining difficulty
  miningReward: 50,                // Reward per block
  maxTransactionsPerBlock: 10,     // Max transactions per block
  targetBlockTime: 60000,          // Target block time (ms)
  difficultyAdjustmentInterval: 10  // Blocks between difficulty adjustments
});
```

## 🔧 Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Development Mode (auto-restart)
```bash
npm run dev
```

### Generate Documentation
```bash
npm run docs
```

## 🌐 Network & Mining

### Solo Mining
The default setup runs as a single node. Mine blocks with:
```bash
node glitchnut-cli.js mine
```

### Mining Pool (Future Feature)
Connect multiple nodes for collaborative mining (implementation coming soon).

### Network Nodes (Future Feature)
P2P networking for decentralized operation (implementation coming soon).

## 📊 Monitoring

### Real-time Monitoring
Use the WebSocket connection to monitor:
- New blocks being mined
- Transactions being added
- Network statistics

### Logging
All operations are logged to console with timestamps and detailed information.

## 🚨 Production Considerations

### For Mainnet Deployment:
1. **Increase Security**:
   - Use hardware security modules for key storage
   - Implement multi-signature wallets
   - Add rate limiting to API endpoints

2. **Scalability**:
   - Implement database storage (PostgreSQL/MongoDB)
   - Add caching layers (Redis)
   - Use load balancers for API servers

3. **Monitoring**:
   - Add comprehensive logging (Winston)
   - Implement metrics collection (Prometheus)
   - Set up alerting systems

4. **Network**:
   - Implement P2P networking
   - Add node discovery mechanisms
   - Implement blockchain synchronization

## 💡 Next Steps

1. **Test the System**: Start with mining a few blocks and sending transactions
2. **Customize Parameters**: Adjust difficulty, rewards, and block times
3. **Build Applications**: Use the API to build wallets and trading platforms
4. **Deploy Network**: Set up multiple nodes for a decentralized network
5. **Add Features**: Implement smart contracts, multi-sig wallets, etc.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs and request features
- **Documentation**: Comprehensive API documentation
- **Community**: Join our development community

---

**Congratulations!** You now have a production-ready cryptocurrency blockchain. Start mining and building the future of digital currency! 🚀