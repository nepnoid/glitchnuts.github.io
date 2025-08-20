// GNC Backend Server - Complete Implementation
// Save this as server.js in your KdawgKeno directory

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gnc_ultra_secure_secret_2025';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnc_ecosystem';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection with error handling
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected successfully');
}).catch((err) => {
  console.log('⚠️ MongoDB connection failed, using in-memory storage');
  console.log('💡 Install MongoDB: https://www.mongodb.com/try/download/community');
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  walletAddress: { type: String, unique: true },
  privateKey: { type: String },
  gncBalance: { type: Number, default: 100 },
  totalMined: { type: Number, default: 0 },
  accountLevel: { type: Number, default: 1 },
  miningPower: { type: Number, default: 1 },
  lastFaucetClaim: { type: Date, default: null },
  kenoStats: {
    gamesPlayed: { type: Number, default: 0 },
    totalWon: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },
    biggestWin: { type: Number, default: 0 }
  },
  referralCode: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// In-memory storage fallback (if MongoDB not available)
let inMemoryUsers = new Map();
let userIdCounter = 1;

// GNC Blockchain Simulator
class GNCBlockchainSimulator {
  constructor() {
    this.nodes = ['localhost:8545', 'localhost:8546', 'localhost:8547'];
    this.activeNodes = 3;
    this.networkStatus = 'connected';
    this.currentBlockHeight = 12500 + Math.floor(Math.random() * 100);
    
    console.log('🔗 GNC Blockchain Simulator initialized');
    console.log(`📊 Block Height: ${this.currentBlockHeight}`);
  }

  generateWalletAddress() {
    const randomBytes = crypto.randomBytes(32);
    return 'gnc' + randomBytes.toString('hex').slice(0, 32);
  }

  generatePrivateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateTxHash() {
    return 'gnc_tx_' + crypto.randomBytes(16).toString('hex');
  }

  async simulateTransaction(fromAddress, toAddress, amount) {
    // Simulate blockchain processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.currentBlockHeight++;
    
    return {
      success: true,
      txHash: this.generateTxHash(),
      blockNumber: this.currentBlockHeight,
      gasUsed: 21000,
      confirmations: 3,
      timestamp: new Date().toISOString()
    };
  }
}

const gnc = new GNCBlockchainSimulator();

// Helper functions for in-memory storage
function saveUser(userData) {
  if (mongoose.connection.readyState === 1) {
    // MongoDB is connected, use it
    return new User(userData).save();
  } else {
    // Use in-memory storage
    const user = { id: userIdCounter++, ...userData };
    inMemoryUsers.set(user.id, user);
    return Promise.resolve(user);
  }
}

function findUser(query) {
  if (mongoose.connection.readyState === 1) {
    // MongoDB is connected, use it
    return User.findOne(query);
  } else {
    // Use in-memory storage
    for (let user of inMemoryUsers.values()) {
      if (
        (query.email && user.email === query.email) ||
        (query.username && user.username === query.username) ||
        (query._id && user.id === query._id)
      ) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(null);
  }
}

function findUserById(id) {
  if (mongoose.connection.readyState === 1) {
    return User.findById(id);
  } else {
    return Promise.resolve(inMemoryUsers.get(parseInt(id)) || null);
  }
}

function updateUser(user) {
  if (mongoose.connection.readyState === 1) {
    return user.save();
  } else {
    inMemoryUsers.set(user.id, user);
    return Promise.resolve(user);
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// USER REGISTRATION
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check existing user
    const existingUser = await findUser({ $or: [{ email }, { username }] }) || 
                        await findUser({ email }) || 
                        await findUser({ username });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate GNC wallet
    const walletAddress = gnc.generateWalletAddress();
    const privateKey = gnc.generatePrivateKey();
    const referralCode = crypto.randomBytes(8).toString('hex');

    // Create user
    const userData = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      walletAddress,
      privateKey,
      referralCode,
      gncBalance: 100, // Welcome bonus
      totalMined: 0,
      accountLevel: 1,
      miningPower: 1,
      kenoStats: {
        gamesPlayed: 0,
        totalWon: 0,
        totalLost: 0,
        biggestWin: 0
      },
      createdAt: new Date(),
      lastLogin: new Date()
    };

    const user = await saveUser(userData);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id || user._id, walletAddress },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Simulate welcome bonus transaction
    const welcomeTx = await gnc.simulateTransaction('faucet', walletAddress, 100);

    res.status(201).json({
      success: true,
      message: 'Welcome to GNC Network!',
      token,
      user: {
        id: user.id || user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        gncBalance: user.gncBalance,
        referralCode: user.referralCode,
        accountLevel: user.accountLevel
      },
      welcomeBonus: {
        amount: 100,
        txHash: welcomeTx.txHash
      }
    });

    console.log(`🎉 New user registered: ${username} (${walletAddress})`);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// USER LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user (try both email and username)
    let user = await findUser({ email: username.toLowerCase() });
    if (!user) {
      user = await findUser({ username: username.toLowerCase() });
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await updateUser(user);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id || user._id, walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id || user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        gncBalance: user.gncBalance,
        totalMined: user.totalMined,
        accountLevel: user.accountLevel,
        miningPower: user.miningPower,
        kenoStats: user.kenoStats
      }
    });

    console.log(`🔐 User logged in: ${user.username}`);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// FAUCET SYSTEM
app.post('/api/faucet/claim', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check 24-hour cooldown
    const now = new Date();
    const lastClaim = user.lastFaucetClaim;
    
    if (lastClaim) {
      const timeDiff = now - new Date(lastClaim);
      const hoursLeft = 24 - (timeDiff / (1000 * 60 * 60));
      
      if (hoursLeft > 0) {
        return res.status(400).json({
          error: 'Faucet cooldown active',
          hoursLeft: Math.ceil(hoursLeft),
          nextClaimTime: new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000)
        });
      }
    }

    // Calculate faucet amount based on account level
    const baseAmount = 50;
    const levelBonus = user.accountLevel * 5;
    const faucetAmount = baseAmount + levelBonus;

    // Update user
    user.gncBalance += faucetAmount;
    user.lastFaucetClaim = now;
    await updateUser(user);

    // Simulate blockchain transaction
    const tx = await gnc.simulateTransaction('faucet', user.walletAddress, faucetAmount);

    res.json({
      success: true,
      message: 'Daily faucet claimed successfully!',
      amount: faucetAmount,
      bonus: levelBonus,
      newBalance: user.gncBalance,
      txHash: tx.txHash,
      nextClaimIn: 24
    });

    console.log(`💧 Faucet claimed: ${user.username} received ${faucetAmount} GNC`);

  } catch (error) {
    console.error('Faucet error:', error);
    res.status(500).json({ error: 'Faucet claim failed' });
  }
});

// MINING SYSTEM
app.post('/api/mining/start', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Simulate mining process
    const miningTime = Math.random() * 2000 + 1000; // 1-3 seconds
    
    setTimeout(async () => {
      // Calculate mining reward
      const baseReward = 25;
      const powerMultiplier = Math.log(user.miningPower + 1) * 0.5;
      const randomBonus = Math.random() * 15;
      const reward = Math.floor(baseReward * powerMultiplier + randomBonus);

      user.gncBalance += reward;
      user.totalMined += reward;
      
      // Level up check
      const levelThreshold = user.accountLevel * 1000;
      if (user.totalMined >= levelThreshold) {
        user.accountLevel += 1;
        user.miningPower += 0.5;
        console.log(`🆙 User ${user.username} leveled up to ${user.accountLevel}!`);
      }

      await updateUser(user);

      // Simulate blockchain transaction
      const tx = await gnc.simulateTransaction('mining_pool', user.walletAddress, reward);
      
      console.log(`⛏️ Mining reward: ${user.username} earned ${reward} GNC`);
    }, miningTime);

    res.json({
      success: true,
      message: 'Mining started!',
      estimatedTime: Math.floor(miningTime / 1000),
      currentPower: user.miningPower,
      accountLevel: user.accountLevel
    });

  } catch (error) {
    console.error('Mining error:', error);
    res.status(500).json({ error: 'Mining failed' });
  }
});

app.post('/api/mining/claim', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate instant mining reward
    const baseReward = 20;
    const powerMultiplier = Math.log(user.miningPower + 1) * 0.3;
    const reward = Math.floor(baseReward * powerMultiplier + Math.random() * 10);

    user.gncBalance += reward;
    user.totalMined += reward;
    
    // Level up check
    if (user.totalMined >= user.accountLevel * 1000) {
      user.accountLevel += 1;
      user.miningPower += 0.5;
    }

    await updateUser(user);

    const tx = await gnc.simulateTransaction('mining_pool', user.walletAddress, reward);

    res.json({
      success: true,
      message: 'Mining completed!',
      reward,
      newBalance: user.gncBalance,
      totalMined: user.totalMined,
      accountLevel: user.accountLevel,
      miningPower: user.miningPower,
      txHash: tx.txHash
    });

    console.log(`⛏️ Mining claimed: ${user.username} earned ${reward} GNC`);

  } catch (error) {
    console.error('Mining claim error:', error);
    res.status(500).json({ error: 'Mining claim failed' });
  }
});

// KENO GAME INTEGRATION
app.post('/api/keno/bet', authenticateToken, async (req, res) => {
  try {
    const { amount, selectedNumbers } = req.body;
    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.gncBalance < amount) {
      return res.status(400).json({ error: 'Insufficient GNC balance' });
    }

    if (!selectedNumbers || selectedNumbers.length === 0) {
      return res.status(400).json({ error: 'Please select numbers to play' });
    }

    // Deduct bet amount
    user.gncBalance -= amount;
    user.kenoStats.gamesPlayed += 1;
    await updateUser(user);

    // Simulate blockchain transaction
    const tx = await gnc.simulateTransaction(user.walletAddress, 'keno_house', amount);

    res.json({
      success: true,
      message: 'Bet placed successfully!',
      betAmount: amount,
      selectedNumbers,
      newBalance: user.gncBalance,
      txHash: tx.txHash
    });

    console.log(`🎯 Keno bet: ${user.username} bet ${amount} GNC`);

  } catch (error) {
    console.error('Keno bet error:', error);
    res.status(500).json({ error: 'Bet placement failed' });
  }
});

app.post('/api/keno/win', authenticateToken, async (req, res) => {
  try {
    const { amount, matches, selectedCount } = req.body;
    const user = await findUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (amount > 0) {
      user.gncBalance += amount;
      user.kenoStats.totalWon += amount;
      
      if (amount > user.kenoStats.biggestWin) {
        user.kenoStats.biggestWin = amount;
      }

      await updateUser(user);

      // Simulate blockchain transaction
      const tx = await gnc.simulateTransaction('keno_house', user.walletAddress, amount);
      
      console.log(`🎉 Keno win: ${user.username} won ${amount} GNC with ${matches} matches!`);

      res.json({
        success: true,
        message: `Congratulations! You won ${amount} GNC!`,
        winAmount: amount,
        matches,
        newBalance: user.gncBalance,
        kenoStats: user.kenoStats,
        txHash: tx.txHash
      });
    } else {
      user.kenoStats.totalLost += req.body.betAmount || 0;
      await updateUser(user);

      res.json({
        success: true,
        message: 'Better luck next time!',
        winAmount: 0,
        matches,
        newBalance: user.gncBalance,
        kenoStats: user.kenoStats
      });
    }

  } catch (error) {
    console.error('Keno win error:', error);
    res.status(500).json({ error: 'Win processing failed' });
  }
});

// USER DASHBOARD
app.get('/api/user/dashboard', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate faucet cooldown
    const now = new Date();
    const lastClaim = user.lastFaucetClaim;
    let faucetCooldown = 0;
    
    if (lastClaim) {
      const timeDiff = now - new Date(lastClaim);
      faucetCooldown = Math.max(0, 24 - (timeDiff / (1000 * 60 * 60)));
    }

    res.json({
      success: true,
      dashboard: {
        user: {
          username: user.username,
          walletAddress: user.walletAddress,
          accountLevel: user.accountLevel,
          createdAt: user.createdAt
        },
        balances: {
          gncBalance: user.gncBalance,
          totalMined: user.totalMined
        },
        mining: {
          miningPower: user.miningPower,
          nextLevelAt: user.accountLevel * 1000
        },
        faucet: {
          available: faucetCooldown === 0,
          cooldownHours: Math.ceil(faucetCooldown),
          nextAmount: 50 + (user.accountLevel * 5)
        },
        gaming: {
          kenoStats: user.kenoStats
        },
        network: {
          status: gnc.networkStatus,
          activeNodes: gnc.activeNodes,
          blockHeight: gnc.currentBlockHeight
        }
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// NETWORK STATUS
app.get('/api/network/status', (req, res) => {
  res.json({
    success: true,
    network: {
      status: gnc.networkStatus,
      activeNodes: gnc.activeNodes,
      totalNodes: gnc.nodes.length,
      blockHeight: gnc.currentBlockHeight,
      chainId: 1337,
      networkId: 'gnc-mainnet'
    },
    server: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage()
    }
  });
});

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    network: gnc.networkStatus,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'in-memory',
    version: '1.0.0'
  });
});

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'GNC Blockchain API',
    version: '1.0.0',
    description: 'Complete backend for Game Network Coin ecosystem',
    endpoints: {
      auth: {
        'POST /api/register': 'Register new user',
        'POST /api/login': 'User login'
      },
      faucet: {
        'POST /api/faucet/claim': 'Claim daily free GNC'
      },
      mining: {
        'POST /api/mining/start': 'Start mining session',
        'POST /api/mining/claim': 'Claim mining rewards'
      },
      keno: {
        'POST /api/keno/bet': 'Place Keno bet',
        'POST /api/keno/win': 'Process Keno win'
      },
      user: {
        'GET /api/user/dashboard': 'Get user dashboard'
      },
      system: {
        'GET /api/network/status': 'Network status',
        'GET /health': 'Health check'
      }
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: '/api'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log('🚀 GNC BACKEND SERVER IS LIVE!');
  console.log('🚀 ========================================');
  console.log(`🌐 API Server: http://localhost:${PORT}`);
  console.log(`📋 Endpoints: http://localhost:${PORT}/api`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Network Status: http://localhost:${PORT}/api/network/status`);
  console.log('🚀 ========================================');
  console.log('🎮 Ready for K-dawg Keno!');
  console.log('💬 Ready for GNC Messenger!');
  console.log('⛏️ Mining system active!');
  console.log('💧 Faucet system online!');
  console.log('🔐 User authentication ready!');
  console.log('🚀 ========================================');
  console.log('💪 YOUR BLOCKCHAIN EMPIRE IS LIVE!');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`❌ Port ${PORT} is busy. Trying port ${PORT + 1}...`);
    server.listen(PORT + 1);
  } else {
    console.error('❌ Server error:', error);
  }
});

module.exports = app;
