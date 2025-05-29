// Glitchnut API Server
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { Glitchnut, Transaction, Wallet } = require('./glitchnut-core');

class GlitchnutAPI {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.wsPort = options.wsPort || 3001;
    this.blockchain = new Glitchnut(options.blockchain || {});
    
    this.app = express();
    this.server = null;
    this.wsServer = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // Serve the wallet HTML file
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'wallet.html'));
    });
  }

  setupRoutes() {
    // Blockchain info routes
    this.app.get('/api/blockchain/stats', (req, res) => {
      res.json(this.blockchain.getChainStats());
    });

    this.app.get('/api/blockchain/blocks', (req, res) => {
      res.json({
        blocks: this.blockchain.chain.slice(-10) // Last 10 blocks
      });
    });

    this.app.get('/api/blockchain/blocks/:index', (req, res) => {
      const index = parseInt(req.params.index);
      const block = this.blockchain.chain[index];
      if (block) {
        res.json(block);
      } else {
        res.status(404).json({ error: 'Block not found' });
      }
    });

    // Wallet routes
    this.app.get('/api/wallets/:address/balance', (req, res) => {
      const balance = this.blockchain.getBalanceOfAddress(req.params.address);
      res.json({ 
        address: req.params.address,
        balance: balance 
      });
    });

    this.app.get('/api/wallets/:address/transactions', (req, res) => {
      const transactions = this.blockchain.getAllTransactionsForAddress(req.params.address);
      res.json({ 
        address: req.params.address,
        transactions: transactions 
      });
    });

    // Transaction routes
    this.app.post('/api/transactions', (req, res) => {
      try {
        const { fromAddress, toAddress, amount, fee = 0, note } = req.body;
        
        const transaction = new Transaction(fromAddress, toAddress, amount, fee);
        transaction.note = note;
        
        // In a real implementation, the transaction would be signed by the client
        // For this demo, we'll skip signature validation
        this.blockchain.addTransaction(transaction);
        
        res.json({
          success: true,
          hash: transaction.hash,
          message: 'Transaction added to pending pool'
        });

        // Broadcast to WebSocket clients
        this.broadcast({
          type: 'new_transaction',
          transaction: transaction
        });

      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/transactions/pending', (req, res) => {
      res.json({
        transactions: this.blockchain.pendingTransactions
      });
    });

    // Mining routes
    this.app.post('/api/mine', (req, res) => {
      try {
        const { miningAddress } = req.body;
        
        if (!miningAddress) {
          return res.status(400).json({
            success: false,
            error: 'Mining address required'
          });
        }

        if (this.blockchain.pendingTransactions.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No pending transactions to mine'
          });
        }

        const startTime = Date.now();
        const block = this.blockchain.minePendingTransactions(miningAddress);
        const endTime = Date.now();

        const response = {
          success: true,
          block: block,
          miningTime: (endTime - startTime) / 1000,
          reward: this.blockchain.miningReward
        };

        // Broadcast to WebSocket clients
        this.broadcast({
          type: 'block_mined',
          block: block,
          miningTime: response.miningTime
        });

        res.json(response);
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Utility routes
    this.app.get('/api/validate', (req, res) => {
      res.json({
        isValid: this.blockchain.isChainValid()
      });
    });

    // Create new wallet
    this.app.post('/api/wallets', (req, res) => {
      const wallet = new Wallet();
      res.json({
        address: wallet.getAddress(),
        publicKey: wallet.getPublicKey()
        // Never send private key over API in real implementation
      });
    });
  }

  setupWebSocket() {
    this.wsServer = new WebSocket.Server({ port: this.wsPort });
    
    this.wsServer.on('connection', (ws) => {
      console.log('WebSocket client connected');
      
      // Send current blockchain stats
      ws.send(JSON.stringify({
        type: 'stats',
        data: this.blockchain.getChainStats()
      }));

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });

    console.log(`WebSocket server running on port ${this.wsPort}`);
  }

  broadcast(message) {
    if (this.wsServer) {
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`🌟 Glitchnut API Server running on port ${this.port}`);
      console.log(`📱 Web wallet: http://localhost:${this.port}`);
      console.log(`🔗 API endpoint: http://localhost:${this.port}/api`);
    });

    this.setupWebSocket();
    
    return this.server;
  }

  stop() {
    if (this.server) {
      this.server.close();
      console.log('API server stopped');
    }
    
    if (this.wsServer) {
      this.wsServer.close();
      console.log('WebSocket server stopped');
    }
  }
}

module.exports = GlitchnutAPI;