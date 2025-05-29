// glitchnut-api.js - REST API Server for Glitchnut
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { Glitchnut, Transaction, Wallet } = require('./glitchnut-core');

class GlitchnutAPI {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.wsPort = options.wsPort || 3001;
    this.blockchain = new Glitchnut(options.blockchain);
    this.wallets = new Map();
    
    // Setup Express app
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    // Setup WebSocket server
    this.setupWebSocket();
    
    // Load default wallet
    this.loadDefaultWallet();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Error handling
    this.app.use((err, req, res, next) => {
      console.error('API Error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
      });
    });
  }

  setupRoutes() {
    // Blockchain endpoints
    this.app.get('/api/blockchain', (req, res) => {
      res.json({
        chain: this.blockchain.chain,
        length: this.blockchain.chain.length
      });
    });

    this.app.get('/api/blockchain/stats', (req, res) => {
      res.json(this.blockchain.getChainStats());
    });

    this.app.get('/api/blockchain/validate', (req, res) => {
      const isValid = this.blockchain.isChainValid();
      res.json({ valid: isValid });
    });

    // Block endpoints
    this.app.get('/api/blocks', (req, res) => {
      const { page = 1, limit = 10 } = req.query;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      
      const blocks = this.blockchain.chain
        .slice()
        .reverse()
        .slice(startIndex, endIndex);
      
      res.json({
        blocks,
        totalBlocks: this.blockchain.chain.length,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });

    this.app.get('/api/blocks/:index', (req, res) => {
      const index = parseInt(req.params.index);
      const block = this.blockchain.chain[index];
      
      if (!block) {
        return res.status(404).json({ error: 'Block not found' });
      }
      
      res.json(block);
    });

    // Transaction endpoints
    this.app.get('/api/transactions/pending', (req, res) => {
      res.json({
        transactions: this.blockchain.pendingTransactions,
        count: this.blockchain.pendingTransactions.length
      });
    });

    this.app.post('/api/transactions', async (req, res) => {
      try {
        const { fromAddress, toAddress, amount, fee = 0, privateKey } = req.body;

        if (!fromAddress || !toAddress || !amount) {
          return res.status(400).json({ 
            error: 'Missing required fields: fromAddress, toAddress, amount' 
          });
        }

        const transaction = new Transaction(fromAddress, toAddress, amount, fee);
        
        if (privateKey) {
          transaction.signTransaction(privateKey);
        }

        this.blockchain.addTransaction(transaction);
        
        // Broadcast to WebSocket clients
        this.broadcastToClients('transactionAdded', transaction);
        
        res.json({ 
          message: 'Transaction added to pending pool',
          transaction: transaction.toJSON()
        });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // Wallet endpoints
    this.app.post('/api/wallets', (req, res) => {
      try {
        const wallet = new Wallet();
        const walletId = Date.now().toString();
        this.wallets.set(walletId, wallet);
        
        // Save wallet to disk
        wallet.save(path.join(this.blockchain.dataDir, `wallet-${walletId}.json`));
        
        res.json({
          walletId,
          address: wallet.getAddress(),
          publicKey: wallet.getPublicKey()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/wallets/:address/balance', (req, res) => {
      const address = req.params.address;
      const balance = this.blockchain.getBalanceOfAddress(address);
      
      res.json({
        address,
        balance,
        confirmedBalance: balance // For now, all balance is confirmed
      });
    });

    this.app.get('/api/wallets/:address/transactions', (req, res) => {
      const address = req.params.address;
      const transactions = [];
      
      for (const block of this.blockchain.chain) {
        for (const tx of block.transactions) {
          if (tx.fromAddress === address || tx.toAddress === address) {
            transactions.push({
              ...tx.toJSON(),
              blockIndex: block.index,
              blockHash: block.hash,
              confirmations: this.blockchain.chain.length - block.index
            });
          }
        }
      }
      
      res.json({
        address,
        transactions: transactions.reverse() // Most recent first
      });
    });

    // Mining endpoints
    this.app.post('/api/mine', async (req, res) => {
      try {
        const { miningAddress } = req.body;
        
        if (!miningAddress) {
          return res.status(400).json({ 
            error: 'Missing miningAddress' 
          });
        }

        if (this.blockchain.pendingTransactions.length === 0) {
          return res.status(400).json({ 
            error: 'No pending transactions to mine' 
          });
        }

        console.log('Starting mining process...');
        const startTime = Date.now();
        
        // Mine in background to avoid blocking
        setImmediate(() => {
          try {
            const block = this.blockchain.minePendingTransactions(miningAddress);
            const endTime = Date.now();
            
            // Broadcast to WebSocket clients
            this.broadcastToClients('blockMined', {
              block: block.toJSON(),
              miningTime: endTime - startTime,
              miner: miningAddress
            });
            
          } catch (error) {
            console.error('Mining error:', error);
            this.broadcastToClients('miningError', { error: error.message });
          }
        });
        
        res.json({ 
          message: 'Mining started',
          pendingTransactions: this.blockchain.pendingTransactions.length
        });
        
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Network endpoints
    this.app.get('/api/network/info', (req, res) => {
      res.json({
        nodeId: this.nodeId || 'local-node',
        version: '1.0.0',
        networkId: 'gliitchnut-mainnet',
        peers: [], // TODO: Implement peer discovery
        uptime: process.uptime()
      });
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        blockchain: {
          blocks: this.blockchain.chain.length,
          isValid: this.blockchain.isChainValid()
        }
      });
    });

    // Serve web interface
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
  }

  setupWebSocket() {
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ port: this.wsPort });
    
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket client connected');
      
      // Send initial blockchain state
      ws.send(JSON.stringify({
        type: 'chainUpdate',
        data: {
          chain: this.blockchain.chain,
          stats: this.blockchain.getChainStats()
        }
      }));
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
    
    // Setup blockchain event listeners
    this.blockchain.on('blockMined', (block) => {
      this.broadcastToClients('blockMined', block.toJSON());
    });
    
    this.blockchain.on('transactionAdded', (transaction) => {
      this.broadcastToClients('transactionAdded', transaction.toJSON());
    });
    
    console.log(`WebSocket server running on port ${this.wsPort}`);
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        // Client wants to subscribe to specific events
        ws.subscriptions = data.events || [];
        break;
        
      case 'getChainUpdate':
        ws.send(JSON.stringify({
          type: 'chainUpdate',
          data: {
            chain: this.blockchain.chain,
            stats: this.blockchain.getChainStats()
          }
        }));
        break;
        
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  broadcastToClients(type, data) {
    const message = JSON.stringify({ type, data });
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  loadDefaultWallet() {
    const defaultWalletPath = path.join(this.blockchain.dataDir, 'default-wallet.json');
    
    try {
      if (require('fs').existsSync(defaultWalletPath)) {
        const defaultWallet = Wallet.load(defaultWalletPath);
        this.wallets.set('default', defaultWallet);
        console.log('Default wallet loaded:', defaultWallet.getAddress());
      } else {
        // Create new default wallet
        const defaultWallet = new Wallet();
        defaultWallet.save(defaultWalletPath);
        this.wallets.set('default', defaultWallet);
        console.log('New default wallet created:', defaultWallet.getAddress());
      }
    } catch (error) {
      console.error('Error loading default wallet:', error);
    }
  }

  getDefaultWallet() {
    return this.wallets.get('default');
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Glitchnut API server running on port ${this.port}`);
      console.log(`WebSocket server running on port ${this.wsPort}`);
      console.log(`Web interface: http://localhost:${this.port}`);
      console.log(`API endpoint: http://localhost:${this.port}/api`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
    if (this.wss) {
      this.wss.close();
    }
    console.log('Glitchnut API server stopped');
  }
}

module.exports = GlitchnutAPI;