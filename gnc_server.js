const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gnc_ecosystem', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});

// GNC Blockchain Simulator
class GNCBlockchain {
    constructor() {
        this.blockHeight = Math.floor(Math.random() * 20000) + 10000;
        this.miningDifficulty = 0.000000000435;
        this.totalSupply = 1000000000; // 1 billion GNC
        this.circulatingSupply = 250000000; // 250 million
        console.log('🔗 GNC Blockchain Simulator initialized');
        console.log(`📊 Block Height: ${this.blockHeight}`);
    }

    mineBlock() {
        this.blockHeight++;
        const reward = Math.random() * 10 + 5; // 5-15 GNC reward
        return {
            blockHeight: this.blockHeight,
            reward: reward.toFixed(4),
            timestamp: new Date().toISOString(),
            difficulty: this.miningDifficulty
        };
    }
}

const blockchain = new GNCBlockchain();

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gncBalance: { type: Number, default: 100 },
    miningPower: { type: Number, default: 1 },
    lastMined: { type: Date, default: null },
    totalMined: { type: Number, default: 0 },
    kenoStats: {
        gamesPlayed: { type: Number, default: 0 },
        totalWon: { type: Number, default: 0 },
        totalBet: { type: Number, default: 0 },
        biggestWin: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Transaction Schema
const transactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ['mining', 'keno_bet', 'keno_win', 'transfer'] },
    amount: Number,
    details: Object,
    timestamp: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Auth Middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) throw new Error();
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gnc_ultra_secure_secret_2025');
        const user = await User.findById(decoded.userId);
        
        if (!user) throw new Error();
        
        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

// Routes

// Register - FIXED: No route parameters needed
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });
        
        await user.save();
        
        // Generate token
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || 'gnc_ultra_secure_secret_2025'
        );
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                gncBalance: user.gncBalance
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login - FIXED: No route parameters needed
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { userId: user._id }, 
            process.env.JWT_SECRET || 'gnc_ultra_secure_secret_2025'
        );
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                gncBalance: user.gncBalance,
                miningPower: user.miningPower,
                kenoStats: user.kenoStats
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get User Profile - FIXED: Removed extra colon
app.get('/api/users/profile', authMiddleware, async (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            gncBalance: req.user.gncBalance,
            miningPower: req.user.miningPower,
            totalMined: req.user.totalMined,
            kenoStats: req.user.kenoStats
        }
    });
});

// Mining Endpoint - FIXED: No route parameters needed
app.post('/api/mining/mine', authMiddleware, async (req, res) => {
    try {
        const user = req.user;
        
        // Check if user can mine (1 hour cooldown)
        if (user.lastMined) {
            const timeSinceLastMine = Date.now() - user.lastMined.getTime();
            const cooldown = 3600000; // 1 hour in milliseconds
            
            if (timeSinceLastMine < cooldown) {
                const timeLeft = Math.ceil((cooldown - timeSinceLastMine) / 60000);
                return res.status(429).json({ 
                    error: `You can mine again in ${timeLeft} minutes` 
                });
            }
        }
        
        // Mine block
        const minedBlock = blockchain.mineBlock();
        const reward = parseFloat(minedBlock.reward) * user.miningPower;
        
        // Update user
        user.gncBalance += reward;
        user.totalMined += reward;
        user.lastMined = new Date();
        await user.save();
        
        // Record transaction
        await Transaction.create({
            userId: user._id,
            type: 'mining',
            amount: reward,
            details: minedBlock
        });
        
        res.json({
            message: 'Mining successful!',
            reward: reward.toFixed(4),
            newBalance: user.gncBalance.toFixed(4),
            blockData: minedBlock
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Keno Game Endpoint - FIXED: No route parameters needed
app.post('/api/keno/play', authMiddleware, async (req, res) => {
    try {
        const { selectedNumbers, betAmount } = req.body;
        const user = req.user;
        
        // Validate bet
        if (betAmount > user.gncBalance) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        if (selectedNumbers.length < 1 || selectedNumbers.length > 10) {
            return res.status(400).json({ error: 'Select between 1 and 10 numbers' });
        }
        
        // Generate drawn numbers
        const drawnNumbers = [];
        while (drawnNumbers.length < 20) {
            const num = Math.floor(Math.random() * 80) + 1;
            if (!drawnNumbers.includes(num)) {
                drawnNumbers.push(num);
            }
        }
        
        // Calculate hits
        const hits = selectedNumbers.filter(num => drawnNumbers.includes(num));
        
        // Calculate payout (simplified)
        const payoutTable = {
            1: { 0: 0, 1: 3 },
            2: { 0: 0, 1: 1, 2: 9 },
            3: { 0: 0, 1: 0, 2: 2, 3: 16 },
            4: { 0: 0, 1: 0, 2: 1, 3: 7, 4: 40 },
            5: { 0: 0, 1: 0, 2: 0, 3: 3, 4: 15, 5: 75 },
            6: { 0: 0, 1: 0, 2: 0, 3: 2, 4: 8, 5: 40, 6: 200 },
            7: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 5, 5: 20, 6: 100, 7: 500 },
            8: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 3, 5: 10, 6: 50, 7: 250, 8: 1000 },
            9: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 6, 6: 25, 7: 125, 8: 500, 9: 2000 },
            10: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 3, 6: 15, 7: 65, 8: 250, 9: 1000, 10: 5000 }
        };
        
        const multiplier = payoutTable[selectedNumbers.length]?.[hits.length] || 0;
        const winAmount = betAmount * multiplier;
        
        // Update balance
        user.gncBalance -= betAmount;
        if (winAmount > 0) {
            user.gncBalance += winAmount;
        }
        
        // Update stats
        user.kenoStats.gamesPlayed++;
        user.kenoStats.totalBet += betAmount;
        user.kenoStats.totalWon += winAmount;
        if (winAmount > user.kenoStats.biggestWin) {
            user.kenoStats.biggestWin = winAmount;
        }
        
        await user.save();
        
        // Record transaction
        await Transaction.create({
            userId: user._id,
            type: winAmount > 0 ? 'keno_win' : 'keno_bet',
            amount: winAmount > 0 ? winAmount - betAmount : -betAmount,
            details: {
                selectedNumbers,
                drawnNumbers,
                hits: hits.length,
                betAmount,
                winAmount
            }
        });
        
        res.json({
            drawnNumbers,
            selectedNumbers,
            hits: hits.length,
            betAmount,
            winAmount,
            newBalance: user.gncBalance.toFixed(4),
            won: winAmount > 0
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get Transactions - FIXED: Removed extra colon
app.get('/api/transactions', authMiddleware, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id })
            .sort({ timestamp: -1 })
            .limit(50);
        
        res.json({ transactions });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Blockchain Stats - FIXED: No route parameters needed
app.get('/api/blockchain/stats', async (req, res) => {
    res.json({
        blockHeight: blockchain.blockHeight,
        totalSupply: blockchain.totalSupply,
        circulatingSupply: blockchain.circulatingSupply,
        miningDifficulty: blockchain.miningDifficulty,
        currentPrice: (Math.random() * 0.01 + 0.005).toFixed(6) // Simulated price
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🎮 KdawgKeno GNC Ecosystem Active`);
    console.log(`💎 Mining & Gaming Platform Ready`);
});
