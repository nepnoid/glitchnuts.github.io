// GNC Backend Server - Complete User Management & Mining System
// File: server.js

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cron = require('node-cron');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gnc_blockchain_secret_2025';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gnc_ecosystem';

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  walletAddress: { type: String, unique: true },
  privateKey: { type: String },
  gncBalance: { type: Number, default: 0 },
  totalMined: { type: Number, default: 0 },
  miningPower: { type: Number, default: 1 },
  lastMiningClaim: { type: Date, default: Date.now },
  lastFaucetClaim: { type: Date, default: null },
  accountLevel: { type: Number, default: 1 },
  achievements: [String],
  kenoStats: {
    gamesPlayed: { type: Number, default: 0 },
    totalWon: { type: Number, default: 0 },
    totalLost: { type: Number, default: 0 },
    biggestWin: { type: Number, default: 0 }
  },
  referralCode: String,
  referredBy: String,
  isActive: { type: Boolean, default: true },
  premiumUntil: Date,
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
});

// Mining Session Schema
const miningSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  walletAddress: String,
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  gncMined: { type: Number, default: 0 },
  hashRate: Number,
  blocksFound: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  fromAddress: String,
  toAddress: String,
  amount: Number,
  type: { type: String, enum: ['mining', 'faucet', 'keno_bet', 'keno_win', 'transfer'] },
  txHash: String,
  blockHeight: Number,
  timestamp: { type: Date, default: Date.now },
  verified: { type: Boolean, default: true }
});

// Faucet Claim Schema
const faucetClaimSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  walletAddress: String,
  amount: Number,
  ipAddress: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const MiningSession = mongoose.model('MiningSession', miningSessionSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const FaucetClaim = mongoose.model('FaucetClaim', faucetClaimSchema);

// Blockchain Simulation Class
class GNCBlockchain {
  constructor() {
    this.difficulty = 4;
    this.miningReward = 10;
    this.faucetAmount = 50;
    this.blockHeight = 1000;
  }

  generateWalletAddress() {
    const randomBytes = crypto.randomBytes(32);
    return 'gnc' + randomBytes.toString('hex').slice(0, 32);
  }

  generatePrivateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateTxHash() {
    return crypto.randomBytes(32).toString('hex');
  }

  calculateMiningReward(miningPower, timeElapsed) {
    const baseReward = this.miningReward;
    const timeBonus = Math.floor(timeElapsed / (1000 * 60)); // bonus per minute
    const powerMultiplier = Math.log(miningPower + 1) * 0.5;
    
    return Math.floor(baseReward * powerMultiplier + timeBonus);
  }

  simulateHashRate(miningPower) {
    return Math.floor(Math.random() * miningPower * 1000) + miningPower * 500;
  }
}

const blockchain = new GNCBlockchain();

// Middleware for authentication
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

// USER REGISTRATION & AUTHENTICATION

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, referralCode } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate wallet
    const walletAddress = blockchain.generateWalletAddress();
    const privateKey = blockchain.generatePrivateKey();
    const userReferralCode = crypto.randomBytes(8).toString('hex');

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      walletAddress,
      privateKey,
      referralCode: userReferralCode,
      referredBy: referralCode,
      gncBalance: 100 // Starting bonus
    });

    await user.save();

    // Create welcome transaction
    const welcomeTx = new Transaction({
      toAddress: walletAddress,
      amount: 100,
      type: 'faucet',
      txHash: blockchain.generateTxHash(),
      blockHeight: blockchain.blockHeight++
    });
    await welcomeTx.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, walletAddress },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        gncBalance: user.gncBalance,
        referralCode: user.referralCode
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({
      $or: [{ email: username }, { username }]
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        walletAddress: user.walletAddress,
        gncBalance: user.gncBalance,
        totalMined: user.totalMined,
        accountLevel: user.accountLevel,
        miningPower: user.miningPower,
        kenoStats: user.kenoStats
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// MINING SYSTEM

app.post('/api/mining/start', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Check if already mining
    const activeMining = await MiningSession.findOne({
      userId: user._id,
      isActive: true
    });

    if (activeMining) {
      return res.status(400).json({ error: 'Already mining' });
    }

    // Start new mining session
    const miningSession = new MiningSession({
      userId: user._id,
      walletAddress: user.walletAddress,
      hashRate: blockchain.simulateHashRate(user.miningPower)
    });

    await miningSession.save();

    res.json({
      success: true,
      message: 'Mining started!',
      session: {
        id: miningSession._id,
        hashRate: miningSession.hashRate,
        startTime: miningSession.startTime
      }
    });

  } catch (error) {
    console.error('Mining start error:', error);
    res.status(500).json({ error: 'Failed to start mining' });
  }
});

app.post('/api/mining/claim', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Find active mining session
    const miningSession = await MiningSession.findOne({
      userId: user._id,
      isActive: true
    });

    if (!miningSession) {
      return res.status(400).json({ error: 'No active mining session' });
    }

    // Calculate mining time and rewards
    const miningTime = Date.now() - miningSession.startTime.getTime();
    const miningHours = miningTime / (1000 * 60 * 60);
    
    if (miningHours < 0.1) { // Minimum 6 minutes
      return res.status(400).json({ 
        error: 'Mining session too short',
        minimumTime: '6 minutes'
      });
    }

    const reward = blockchain.calculateMiningReward(user.miningPower, miningTime);
    const blocksFound = Math.floor(Math.random() * 3) + 1;

    // Update mining session
    miningSession.endTime = new Date();
    miningSession.gncMined = reward;
    miningSession.blocksFound = blocksFound;
    miningSession.isActive = false;
    await miningSession.save();

    // Update user balance and stats
    user.gncBalance += reward;
    user.totalMined += reward;
    user.lastMiningClaim = new Date();
    
    // Level up check
    if (user.totalMined > user.accountLevel * 1000) {
      user.accountLevel += 1;
      user.miningPower += 0.5;
    }

    await user.save();

    // Create transaction record
    const miningTx = new Transaction({
      toAddress: user.walletAddress,
      amount: reward,
      type: 'mining',
      txHash: blockchain.generateTxHash(),
      blockHeight: blockchain.blockHeight++
    });
    await miningTx.save();

    res.json({
      success: true,
      message: 'Mining rewards claimed!',
      reward,
      blocksFound,
      miningTime: Math.floor(miningHours * 100) / 100,
      newBalance: user.gncBalance,
      totalMined: user.totalMined,
      accountLevel: user.accountLevel
    });

  } catch (error) {
    console.error('Mining claim error:', error);
    res.status(500).json({ error: 'Failed to claim mining rewards' });
  }
});

// AUTO FAUCET SYSTEM

app.post('/api/faucet/claim', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const clientIP = req.ip || req.connection.remoteAddress;

    // Check cooldown (24 hours)
    const now = new Date();
    const lastClaim = user.lastFaucetClaim;
    
    if (lastClaim) {
      const timeDiff = now - lastClaim;
      const hoursLeft = 24 - (timeDiff / (1000 * 60 * 60));
      
      if (hoursLeft > 0) {
        return res.status(400).json({
          error: 'Faucet cooldown active',
          hoursLeft: Math.ceil(hoursLeft)
        });
      }
    }

    // Check IP cooldown
    const recentClaim = await FaucetClaim.findOne({
      ipAddress: clientIP,
      timestamp: { $gte: new Date(now - 24 * 60 * 60 * 1000) }
    });

    if (recentClaim) {
      return res.status(400).json({
        error: 'IP address already claimed today'
      });
    }

    // Calculate faucet amount based on account level
    const baseAmount = blockchain.faucetAmount;
    const levelBonus = user.accountLevel * 5;
    const faucetAmount = baseAmount + levelBonus;

    // Update user
    user.gncBalance += faucetAmount;
    user.lastFaucetClaim = now;
    await user.save();

    // Record claim
    const faucetClaim = new FaucetClaim({
      userId: user._id,
      walletAddress: user.walletAddress,
      amount: faucetAmount,
      ipAddress: clientIP
    });
    await faucetClaim.save();

    // Create transaction
    const faucetTx = new Transaction({
      toAddress: user.walletAddress,
      amount: faucetAmount,
      type: 'faucet',
      txHash: blockchain.generateTxHash(),
      blockHeight: blockchain.blockHeight++
    });
    await faucetTx.save();

    res.json({
      success: true,
      message: 'Faucet claimed successfully!',
      amount: faucetAmount,
      newBalance: user.gncBalance,
      nextClaimIn: 24 // hours
    });

  } catch (error) {
    console.error('Faucet error:', error);
    res.status(500).json({ error: 'Faucet claim failed' });
  }
});

// USER PROGRESS & STATS

app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -privateKey');
    
    // Get mining stats
    const miningStats = await MiningSession.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalMined: { $sum: '$gncMined' },
          totalBlocks: { $sum: '$blocksFound' }
        }
      }
    ]);

    // Get recent transactions
    const recentTx = await Transaction.find({
      $or: [
        { toAddress: user.walletAddress },
        { fromAddress: user.walletAddress }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(10);

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        miningStats: miningStats[0] || { totalSessions: 0, totalMined: 0, totalBlocks: 0 },
        recentTransactions: recentTx
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.get('/api/user/dashboard', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Check active mining
    const activeMining = await MiningSession.findOne({
      userId: user._id,
      isActive: true
    });

    // Faucet status
    const now = new Date();
    const faucetCooldown = user.lastFaucetClaim ? 
      Math.max(0, 24 - ((now - user.lastFaucetClaim) / (1000 * 60 * 60))) : 0;

    res.json({
      success: true,
      dashboard: {
        gncBalance: user.gncBalance,
        totalMined: user.totalMined,
        accountLevel: user.accountLevel,
        miningPower: user.miningPower,
        activeMining: !!activeMining,
        miningSession: activeMining,
        faucetAvailable: faucetCooldown === 0,
        faucetCooldown: Math.ceil(faucetCooldown),
        kenoStats: user.kenoStats,
        achievements: user.achievements
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
});

// KENO GAME INTEGRATION

app.post('/api/keno/bet', authenticateToken, async (req, res) => {
  try {
    const { amount, selectedNumbers } = req.body;
    const user = await User.findById(req.user.userId);

    if (user.gncBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct bet amount
    user.gncBalance -= amount;
    user.kenoStats.gamesPlayed += 1;
    await user.save();

    // Create bet transaction
    const betTx = new Transaction({
      fromAddress: user.walletAddress,
      toAddress: 'keno_house',
      amount,
      type: 'keno_bet',
      txHash: blockchain.generateTxHash(),
      blockHeight: blockchain.blockHeight++
    });
    await betTx.save();

    res.json({
      success: true,
      newBalance: user.gncBalance,
      txHash: betTx.txHash
    });

  } catch (error) {
    console.error('Keno bet error:', error);
    res.status(500).json({ error: 'Bet failed' });
  }
});

app.post('/api/keno/win', authenticateToken, async (req, res) => {
  try {
    const { amount, matches } = req.body;
    const user = await User.findById(req.user.userId);

    if (amount > 0) {
      user.gncBalance += amount;
      user.kenoStats.totalWon += amount;
      
      if (amount > user.kenoStats.biggestWin) {
        user.kenoStats.biggestWin = amount;
      }
    } else {
      user.kenoStats.totalLost += req.body.betAmount || 0;
    }

    await user.save();

    // Create win transaction
    if (amount > 0) {
      const winTx = new Transaction({
        fromAddress: 'keno_house',
        toAddress: user.walletAddress,
        amount,
        type: 'keno_win',
        txHash: blockchain.generateTxHash(),
        blockHeight: blockchain.blockHeight++
      });
      await winTx.save();
    }

    res.json({
      success: true,
      newBalance: user.gncBalance,
      kenoStats: user.kenoStats
    });

  } catch (error) {
    console.error('Keno win error:', error);
    res.status(500).json({ error: 'Win processing failed' });
  }
});

// AUTO MINING REWARDS (Background Tasks)
cron.schedule('*/15 * * * *', async () => {
  try {
    console.log('Processing auto mining rewards...');
    
    // Find long-running mining sessions and auto-claim
    const longSessions = await MiningSession.find({
      isActive: true,
      startTime: { $lt: new Date(Date.now() - 4 * 60 * 60 * 1000) } // 4+ hours
    }).populate('userId');

    for (const session of longSessions) {
      const miningTime = Date.now() - session.startTime.getTime();
      const reward = blockchain.calculateMiningReward(session.userId.miningPower, miningTime);
      
      // Auto-claim rewards
      session.endTime = new Date();
      session.gncMined = reward;
      session.isActive = false;
      await session.save();

      session.userId.gncBalance += reward;
      session.userId.totalMined += reward;
      await session.userId.save();

      console.log(`Auto-claimed ${reward} GNC for user ${session.userId.username}`);
    }
  } catch (error) {
    console.error('Auto mining error:', error);
  }
});

// ADMIN ENDPOINTS

app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeMiners = await MiningSession.countDocuments({ isActive: true });
    const totalGNCMined = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalMined' } } }
    ]);
    const totalTransactions = await Transaction.countDocuments();

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeMiners,
        totalGNCMined: totalGNCMined[0]?.total || 0,
        totalTransactions,
        blockHeight: blockchain.blockHeight
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GNC Backend Server running on port ${PORT}`);
  console.log('🔗 Connected to blockchain');
  console.log('⛏️ Auto-mining system active');
  console.log('💧 Faucet system online');
  console.log('👤 User management ready');
});

module.exports = app;
