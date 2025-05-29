// Glitchnut Cryptocurrency Core Implementation
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1'); // Same curve used by Bitcoin

class Block {
  constructor(index, timestamp, transactions, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  calculateHash() {
    return crypto.createHash('sha256')
      .update(this.index + this.timestamp + JSON.stringify(this.transactions) + this.previousHash + this.nonce)
      .digest('hex');
  }

  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join('0');
    console.log(`Mining block with difficulty ${difficulty}...`);
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
      
      // Log progress every 100000 attempts
      if (this.nonce % 100000 === 0) {
        console.log(`Mining attempt: ${this.nonce}`);
      }
    }
    
    console.log(`Block mined: ${this.hash}`);
  }
}

class Transaction {
  constructor(fromAddress, toAddress, amount, fee = 0) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.fee = fee;
    this.timestamp = Date.now();
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto.createHash('sha256')
      .update(this.fromAddress + this.toAddress + this.amount + this.fee + this.timestamp)
      .digest('hex');
  }

  signTransaction(signingKey) {
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
    
    const hashTx = this.calculateHash();
    const signature = signingKey.sign(hashTx, 'base64');
    this.signature = signature.toDER('hex');
  }

  isValid() {
    if (this.fromAddress === null) return true; // Mining rewards have no sender

    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }

    const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
    return publicKey.verify(this.calculateHash(), this.signature);
  }
}

class Wallet {
  constructor() {
    this.keyPair = ec.genKeyPair();
    this.publicKey = this.keyPair.getPublic('hex');
    this.privateKey = this.keyPair.getPrivate('hex');
  }

  getAddress() {
    return this.publicKey;
  }

  getPublicKey() {
    return this.publicKey;
  }

  getPrivateKey() {
    return this.privateKey;
  }

  signTransaction(transaction) {
    if (transaction.fromAddress !== this.getAddress()) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
    transaction.signTransaction(this.keyPair);
  }

  save(filename) {
    const walletData = {
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      address: this.getAddress(),
      createdAt: Date.now()
    };

    // Ensure directory exists
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filename, JSON.stringify(walletData, null, 2));
  }

  static load(filename) {
    if (!fs.existsSync(filename)) {
      throw new Error('Wallet file not found');
    }

    const walletData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const wallet = new Wallet();
    
    // Restore key pair from private key
    wallet.keyPair = ec.keyFromPrivate(walletData.privateKey, 'hex');
    wallet.publicKey = walletData.publicKey;
    wallet.privateKey = walletData.privateKey;
    
    return wallet;
  }
}

class Glitchnut {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './glitchnut-data';
    this.difficulty = options.difficulty || 4;
    this.miningReward = options.miningReward || 50;
    this.chain = [this.createGenesisBlock()];
    this.pendingTransactions = [];
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.loadChain();
  }

  createGenesisBlock() {
    const genesisBlock = new Block(0, Date.now(), [], "0");
    genesisBlock.hash = genesisBlock.calculateHash();
    return genesisBlock;
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  minePendingTransactions(miningRewardAddress) {
    // Add mining reward transaction
    const rewardTx = new Transaction(null, miningRewardAddress, this.miningReward);
    this.pendingTransactions.push(rewardTx);
    
    const block = new Block(
      this.chain.length,
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    
    block.mineBlock(this.difficulty);

    console.log('Block successfully mined!');
    this.chain.push(block);

    // Clear pending transactions
    this.pendingTransactions = [];
    
    // Save chain to disk
    this.saveChain();
    
    return block;
  }

  addTransaction(transaction) {
    if (!transaction.fromAddress || !transaction.toAddress) {
      throw new Error('Transaction must include from and to address');
    }

    if (!transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }

    if (transaction.amount <= 0) {
      throw new Error('Transaction amount should be higher than 0');
    }

    // Check if sender has enough balance (including fee)
    const senderBalance = this.getBalanceOfAddress(transaction.fromAddress);
    if (senderBalance < transaction.amount + transaction.fee) {
      throw new Error('Not enough balance for transaction and fee');
    }

    this.pendingTransactions.push(transaction);
    console.log('Transaction added to pending pool');
  }

  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= (trans.amount + trans.fee);
        }
        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  getAllTransactionsForAddress(address) {
    const transactions = [];

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address || trans.toAddress === address) {
          transactions.push({
            ...trans,
            blockIndex: block.index,
            blockHash: block.hash,
            confirmations: this.chain.length - block.index
          });
        }
      }
    }

    return transactions;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
      
      // Validate each transaction in the block
      for (const tx of currentBlock.transactions) {
        if (!tx.isValid()) {
          return false;
        }
      }
    }
    return true;
  }

  getChainStats() {
    let totalTransactions = 0;
    let totalSupply = 0;

    for (const block of this.chain) {
      totalTransactions += block.transactions.length;
      
      // Calculate total supply from mining rewards
      for (const tx of block.transactions) {
        if (tx.fromAddress === null) { // Mining reward
          totalSupply += tx.amount;
        }
      }
    }

    return {
      totalBlocks: this.chain.length,
      totalTransactions,
      totalSupply,
      difficulty: this.difficulty,
      pendingTransactions: this.pendingTransactions.length,
      isValid: this.isChainValid()
    };
  }

  saveChain() {
    const chainFile = path.join(this.dataDir, 'blockchain.json');
    const chainData = {
      chain: this.chain,
      difficulty: this.difficulty,
      miningReward: this.miningReward,
      pendingTransactions: this.pendingTransactions
    };
    
    fs.writeFileSync(chainFile, JSON.stringify(chainData, null, 2));
  }

  loadChain() {
    const chainFile = path.join(this.dataDir, 'blockchain.json');
    
    if (fs.existsSync(chainFile)) {
      try {
        const chainData = JSON.parse(fs.readFileSync(chainFile, 'utf8'));
        this.chain = chainData.chain || [this.createGenesisBlock()];
        this.difficulty = chainData.difficulty || this.difficulty;
        this.miningReward = chainData.miningReward || this.miningReward;
        this.pendingTransactions = chainData.pendingTransactions || [];
        
        console.log('Blockchain loaded from disk');
      } catch (error) {
        console.log('Error loading blockchain, starting fresh:', error.message);
        this.chain = [this.createGenesisBlock()];
      }
    }
  }
}

module.exports = {
  Glitchnut,
  Transaction,
  Wallet,
  Block
};