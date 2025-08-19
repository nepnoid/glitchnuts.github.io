// glitchnut-core.js - Production Glitchnut Cryptocurrency
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class GlitchnutCrypto {
  static sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('secp256k1', {
      publicKeyEncoding: { type: 'spki', format: 'hex' },
      privateKeyEncoding: { type: 'pkcs8', format: 'hex' }
    });
    return { publicKey, privateKey };
  }

  static signData(data, privateKey) {
    const sign = crypto.createSign('sha256');
    sign.update(data);
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.from(privateKey, 'hex'),
      format: 'der',
      type: 'pkcs8'
    });
    return sign.sign(privateKeyObj, 'hex');
  }

  static verifySignature(data, signature, publicKey) {
    try {
      const verify = crypto.createVerify('sha256');
      verify.update(data);
      const publicKeyObj = crypto.createPublicKey({
        key: Buffer.from(publicKey, 'hex'),
        format: 'der',
        type: 'spki'
      });
      return verify.verify(publicKeyObj, signature, 'hex');
    } catch (error) {
      return false;
    }
  }

  static generateAddress(publicKey) {
    const hash1 = crypto.createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest();
    const hash2 = crypto.createHash('ripemd160').update(hash1).digest();
    return 'GNC' + hash2.toString('hex').toUpperCase();
  }
}

class Transaction {
  constructor(fromAddress, toAddress, amount, fee = 0) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.fee = fee;
    this.timestamp = Date.now();
    this.signature = null;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return GlitchnutCrypto.sha256(
      this.fromAddress + 
      this.toAddress + 
      this.amount + 
      this.fee + 
      this.timestamp
    );
  }

  signTransaction(privateKey) {
    if (!this.fromAddress) {
      throw new Error('Cannot sign mining reward transactions');
    }
    
    const hashTx = this.calculateHash();
    this.signature = GlitchnutCrypto.signData(hashTx, privateKey);
  }

  isValid() {
    // Mining reward transaction
    if (this.fromAddress === null) return true;

    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }

    return GliitchnutCrypto.verifySignature(
      this.calculateHash(), 
      this.signature, 
      this.fromAddress
    );
  }

  toJSON() {
    return {
      fromAddress: this.fromAddress,
      toAddress: this.toAddress,
      amount: this.amount,
      fee: this.fee,
      timestamp: this.timestamp,
      signature: this.signature,
      hash: this.hash
    };
  }

  static fromJSON(data) {
    const tx = new Transaction(data.fromAddress, data.toAddress, data.amount, data.fee);
    tx.timestamp = data.timestamp;
    tx.signature = data.signature;
    tx.hash = data.hash;
    return tx;
  }
}

class Block {
  constructor(index, timestamp, transactions, previousHash, difficulty = 4) {
    this.index = index;
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.difficulty = difficulty;
    this.nonce = 0;
    this.merkleRoot = this.calculateMerkleRoot();
    this.hash = this.calculateHash();
  }

  calculateMerkleRoot() {
    if (this.transactions.length === 0) return '';
    
    let level = this.transactions.map(tx => tx.hash);
    
    while (level.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = level[i + 1] || left;
        nextLevel.push(GlitchnutCrypto.sha256(left + right));
      }
      level = nextLevel;
    }
    
    return level[0];
  }

  calculateHash() {
    return GliitchnutCrypto.sha256(
      this.index +
      this.timestamp +
      this.merkleRoot +
      this.previousHash +
      this.difficulty +
      this.nonce
    );
  }

  mineBlock() {
    const target = Array(this.difficulty + 1).join('0');
    
    console.log(`Mining block ${this.index}...`);
    const startTime = Date.now();
    
    while (this.hash.substring(0, this.difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
      
      // Log progress every 100000 attempts
      if (this.nonce % 100000 === 0) {
        console.log(`Nonce: ${this.nonce}, Hash: ${this.hash}`);
      }
    }
    
    const endTime = Date.now();
    console.log(`Block mined: ${this.hash} (took ${endTime - startTime}ms, nonce: ${this.nonce})`);
  }

  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        return false;
      }
    }
    return true;
  }

  toJSON() {
    return {
      index: this.index,
      timestamp: this.timestamp,
      transactions: this.transactions.map(tx => tx.toJSON()),
      previousHash: this.previousHash,
      difficulty: this.difficulty,
      nonce: this.nonce,
      merkleRoot: this.merkleRoot,
      hash: this.hash
    };
  }

  static fromJSON(data) {
    const transactions = data.transactions.map(txData => Transaction.fromJSON(txData));
    const block = new Block(
      data.index,
      data.timestamp,
      transactions,
      data.previousHash,
      data.difficulty
    );
    block.nonce = data.nonce;
    block.merkleRoot = data.merkleRoot;
    block.hash = data.hash;
    return block;
  }
}

class Wallet {
  constructor() {
    this.keyPair = GliitchnutCrypto.generateKeyPair();
    this.address = GliitchnutCrypto.generateAddress(this.keyPair.publicKey);
  }

  getAddress() {
    return this.address;
  }

  getPublicKey() {
    return this.keyPair.publicKey;
  }

  getPrivateKey() {
    return this.keyPair.privateKey;
  }

  signTransaction(transaction) {
    transaction.signTransaction(this.keyPair.privateKey);
  }

  save(filepath) {
    const walletData = {
      address: this.address,
      publicKey: this.keyPair.publicKey,
      privateKey: this.keyPair.privateKey
    };
    
    fs.writeFileSync(filepath, JSON.stringify(walletData, null, 2));
    console.log(`Wallet saved to ${filepath}`);
  }

  static load(filepath) {
    if (!fs.existsSync(filepath)) {
      throw new Error(`Wallet file not found: ${filepath}`);
    }
    
    const walletData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const wallet = Object.create(Wallet.prototype);
    
    wallet.keyPair = {
      publicKey: walletData.publicKey,
      privateKey: walletData.privateKey
    };
    wallet.address = walletData.address;
    
    return wallet;
  }
}

class Glitchnut extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.chain = [];
    this.difficulty = options.difficulty || 4;
    this.pendingTransactions = [];
    this.miningReward = options.miningReward || 50;
    this.maxTransactionsPerBlock = options.maxTransactionsPerBlock || 10;
    this.targetBlockTime = options.targetBlockTime || 60000; // 1 minute
    this.difficultyAdjustmentInterval = options.difficultyAdjustmentInterval || 10;
    
    // Create data directory
    this.dataDir = options.dataDir || './glitchnut-data';
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Initialize or load blockchain
    this.loadBlockchain();
    
    if (this.chain.length === 0) {
      this.chain.push(this.createGenesisBlock());
      this.saveBlockchain();
    }
    
    console.log(`Glitchnut blockchain initialized with ${this.chain.length} blocks`);
  }

  createGenesisBlock() {
    const genesisTransactions = [];
    return new Block(0, Date.now(), genesisTransactions, '0', this.difficulty);
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
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

    const walletBalance = this.getBalanceOfAddress(transaction.fromAddress);
    if (walletBalance < transaction.amount + transaction.fee) {
      throw new Error('Not enough balance');
    }

    this.pendingTransactions.push(transaction);
    this.emit('transactionAdded', transaction);
    
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

  minePendingTransactions(miningRewardAddress) {
    // Select transactions for the block (prioritize by fee)
    const selectedTransactions = this.pendingTransactions
      .sort((a, b) => b.fee - a.fee)
      .slice(0, this.maxTransactionsPerBlock);

    // Calculate total fees
    const totalFees = selectedTransactions.reduce((sum, tx) => sum + tx.fee, 0);

    // Add mining reward transaction
    const rewardTx = new Transaction(
      null, 
      miningRewardAddress, 
      this.miningReward + totalFees
    );
    selectedTransactions.push(rewardTx);

    // Create new block
    const block = new Block(
      this.getLatestBlock().index + 1,
      Date.now(),
      selectedTransactions,
      this.getLatestBlock().hash,
      this.difficulty
    );

    // Mine the block
    block.mineBlock();

    // Add to chain
    this.chain.push(block);

    // Remove mined transactions from pending pool
    this.pendingTransactions = this.pendingTransactions.filter(
      pendingTx => !selectedTransactions.some(selectedTx => 
        selectedTx.hash === pendingTx.hash
      )
    );

    // Adjust difficulty if needed
    this.adjustDifficulty();

    // Save blockchain
    this.saveBlockchain();

    this.emit('blockMined', block);
    console.log(`Block ${block.index} mined successfully!`);
    
    return block;
  }

  adjustDifficulty() {
    if (this.chain.length % this.difficultyAdjustmentInterval !== 0) {
      return;
    }

    const latestBlock = this.getLatestBlock();
    const prevAdjustmentBlock = this.chain[this.chain.length - this.difficultyAdjustmentInterval];
    
    const timeExpected = this.targetBlockTime * this.difficultyAdjustmentInterval;
    const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;

    if (timeTaken < timeExpected / 2) {
      this.difficulty++;
      console.log(`Difficulty increased to ${this.difficulty}`);
    } else if (timeTaken > timeExpected * 2) {
      this.difficulty = Math.max(1, this.difficulty - 1);
      console.log(`Difficulty decreased to ${this.difficulty}`);
    }
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!currentBlock.hasValidTransactions()) {
        console.log('Invalid transaction found in block', currentBlock.index);
        return false;
      }

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.log('Invalid hash at block', currentBlock.index);
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log('Invalid previous hash at block', currentBlock.index);
        return false;
      }
    }

    return true;
  }

  saveBlockchain() {
    const chainPath = path.join(this.dataDir, 'blockchain.json');
    const chainData = {
      chain: this.chain.map(block => block.toJSON()),
      difficulty: this.difficulty,
      pendingTransactions: this.pendingTransactions.map(tx => tx.toJSON())
    };
    
    fs.writeFileSync(chainPath, JSON.stringify(chainData, null, 2));
  }

  loadBlockchain() {
    const chainPath = path.join(this.dataDir, 'blockchain.json');
    
    if (fs.existsSync(chainPath)) {
      try {
        const chainData = JSON.parse(fs.readFileSync(chainPath, 'utf8'));
        this.chain = chainData.chain.map(blockData => Block.fromJSON(blockData));
        this.difficulty = chainData.difficulty || this.difficulty;
        this.pendingTransactions = (chainData.pendingTransactions || [])
          .map(txData => Transaction.fromJSON(txData));
        
        console.log('Blockchain loaded from disk');
      } catch (error) {
        console.error('Error loading blockchain:', error.message);
        this.chain = [];
      }
    }
  }

  getChainStats() {
    const totalSupply = this.chain.reduce((sum, block) => {
      return sum + block.transactions
        .filter(tx => tx.fromAddress === null)
        .reduce((blockSum, tx) => blockSum + tx.amount, 0);
    }, 0);

    return {
      totalBlocks: this.chain.length,
      totalTransactions: this.chain.reduce((sum, block) => sum + block.transactions.length, 0),
      totalSupply,
      difficulty: this.difficulty,
      pendingTransactions: this.pendingTransactions.length,
      isValid: this.isChainValid()
    };
  }

  // Network synchronization methods (for future P2P implementation)
  broadcastTransaction(transaction) {
    this.emit('transactionBroadcast', transaction);
  }

  broadcastBlock(block) {
    this.emit('blockBroadcast', block);
  }

  syncWithPeer(peerChain) {
    if (peerChain.length > this.chain.length && this.isValidChain(peerChain)) {
      console.log('Replacing chain with longer valid chain from peer');
      this.chain = peerChain;
      this.saveBlockchain();
      this.emit('chainReplaced', peerChain);
    }
  }

  isValidChain(chain) {
    // Validate entire chain
    for (let i = 1; i < chain.length; i++) {
      const currentBlock = chain[i];
      const previousBlock = chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash() ||
          currentBlock.previousHash !== previousBlock.hash ||
          !currentBlock.hasValidTransactions()) {
        return false;
      }
    }
    return true;
  }
}

module.exports = {
  Glitchnut,
  Transaction,
  Block,
  Wallet,
  GlitchnutCrypto
};