#!/usr/bin/env node
// gliitchnut-cli.js - Command Line Interface for Gliitchnut
const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Glitchnut, Transaction, Wallet } = require('./glitchnut-core');
const GlitchnutAPI = require('./glitchnut-api');

const program = new Command();

class GlitchnutCLI {
  constructor() {
    this.blockchain = null;
    this.apiServer = null;
    this.defaultWallet = null;
  }

  async init() {
    console.log(chalk.blue.bold('🌟 Glitchnut Cryptocurrency Node'));
    console.log(chalk.gray('Initializing blockchain...'));
    
    this.blockchain = new Glitchnut({
      dataDir: './glitchnut-data',
      difficulty: 4,
      miningReward: 50
    });
    
    // Load or create default wallet
    try {
      this.defaultWallet = Wallet.load('./glitchnut-data/default-wallet.json');
    } catch (error) {
      this.defaultWallet = new Wallet();
      this.defaultWallet.save('./glitchnut-data/default-wallet.json');
      console.log(chalk.green('✓ New default wallet created'));
    }
    
    console.log(chalk.green('✓ Blockchain initialized'));
    console.log(chalk.gray(`Default wallet: ${this.defaultWallet.getAddress()}`));
  }

  displayChainStats() {
    const stats = this.blockchain.getChainStats();
    
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [25, 30]
    });

    table.push(
      ['Total Blocks', stats.totalBlocks],
      ['Total Transactions', stats.totalTransactions],
      ['Total Supply', `${stats.totalSupply} GNC`],
      ['Mining Difficulty', stats.difficulty],
      ['Pending Transactions', stats.pendingTransactions],
      ['Chain Valid', stats.isValid ? chalk.green('✓ Yes') : chalk.red('✗ No')]
    );

    console.log('\n' + chalk.bold('📊 Blockchain Statistics'));
    console.log(table.toString());
  }

  displayRecentBlocks(count = 5) {
    const blocks = this.blockchain.chain.slice(-count).reverse();
    
    const table = new Table({
      head: [
        chalk.cyan('Index'), 
        chalk.cyan('Hash'), 
        chalk.cyan('Transactions'), 
        chalk.cyan('Timestamp')
      ],
      colWidths: [8, 20, 15, 25]
    });

    blocks.forEach(block => {
      table.push([
        block.index,
        block.hash.substring(0, 16) + '...',
        block.transactions.length,
        new Date(block.timestamp).toLocaleString()
      ]);
    });

    console.log('\n' + chalk.bold('⛓️ Recent Blocks'));
    console.log(table.toString());
  }

  async sendTransaction() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'toAddress',
        message: 'Recipient address:',
        validate: (input) => input.length > 0 || 'Address is required'
      },
      {
        type: 'number',
        name: 'amount',
        message: 'Amount to send (GNC):',
        validate: (input) => input > 0 || 'Amount must be greater than 0'
      },
      {
        type: 'number',
        name: 'fee',
        message: 'Transaction fee (GNC):',
        default: 0.1
      }
    ]);

    try {
      const balance = this.blockchain.getBalanceOfAddress(this.defaultWallet.getAddress());
      
      if (balance < answers.amount + answers.fee) {
        console.log(chalk.red('✗ Insufficient balance'));
        console.log(chalk.gray(`Available: ${balance} GNC, Required: ${answers.amount + answers.fee} GNC`));
        return;
      }

      const transaction = new Transaction(
        this.defaultWallet.getAddress(),
        answers.toAddress,
        answers.amount,
        answers.fee
      );

      this.defaultWallet.signTransaction(transaction);
      this.blockchain.addTransaction(transaction);

      console.log(chalk.green('✓ Transaction added to pending pool'));
      console.log(chalk.gray(`Transaction hash: ${transaction.hash}`));
    } catch (error) {
      console.log(chalk.red('✗ Transaction failed:'), error.message);
    }
  }

  async mineBlock() {
    if (this.blockchain.pendingTransactions.length === 0) {
      console.log(chalk.yellow('⚠ No pending transactions to mine'));
      return;
    }

    console.log(chalk.blue('⛏️ Starting mining process...'));
    console.log(chalk.gray(`Mining to address: ${this.defaultWallet.getAddress()}`));
    
    const startTime = Date.now();
    
    try {
      const block = this.blockchain.minePendingTransactions(this.defaultWallet.getAddress());
      const endTime = Date.now();
      const miningTime = (endTime - startTime) / 1000;
      
      console.log(chalk.green('✓ Block mined successfully!'));
      console.log(chalk.gray(`Block #${block.index} | Hash: ${block.hash}`));
      console.log(chalk.gray(`Mining time: ${miningTime.toFixed(2)} seconds`));
      console.log(chalk.gray(`Reward: 50 GNC + fees`));
      
      const newBalance = this.blockchain.getBalanceOfAddress(this.defaultWallet.getAddress());
      console.log(chalk.green(`New balance: ${newBalance} GNC`));
      
    } catch (error) {
      console.log(chalk.red('✗ Mining failed:'), error.message);
    }
  }

  displayWalletInfo() {
    const address = this.defaultWallet.getAddress();
    const balance = this.blockchain.getBalanceOfAddress(address);
    
    console.log('\n' + chalk.bold('💰 Wallet Information'));
    console.log(chalk.gray('Address:'), chalk.white(address));
    console.log(chalk.gray('Balance:'), chalk.green(`${balance} GNC`));
    console.log(chalk.gray('Public Key:'), this.defaultWallet.getPublicKey().substring(0, 32) + '...');
  }

  async startAPIServer() {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'port',
        message: 'API server port:',
        default: 3000
      },
      {
        type: 'number',
        name: 'wsPort',
        message: 'WebSocket port:',
        default: 3001
      }
    ]);

    this.apiServer = new GlitchnutAPI({
      port: answers.port,
      wsPort: answers.wsPort,
      blockchain: {
        dataDir: './glitchnut-data',
        difficulty: 4,
        miningReward: 50
      }
    });

    this.apiServer.start();
    
    console.log(chalk.green('✓ API server started'));
    console.log(chalk.gray(`Web interface: http://localhost:${answers.port}`));
    console.log(chalk.gray(`API endpoint: http://localhost:${answers.port}/api`));
    console.log(chalk.gray('Press Ctrl+C to stop'));
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n' + chalk.yellow('Shutting down API server...'));
      this.apiServer.stop();
      process.exit(0);
    });
  }

  async interactiveMode() {
    while (true) {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📊 View blockchain statistics', value: 'stats' },
            { name: '⛓️ View recent blocks', value: 'blocks' },
            { name: '💰 View wallet info', value: 'wallet' },
            { name: '💸 Send transaction', value: 'send' },
            { name: '⛏️ Mine block', value: 'mine' },
            { name: '🌐 Start API server', value: 'api' },
            { name: '🔄 Validate blockchain', value: 'validate' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }
      ]);

      switch (answers.action) {
        case 'stats':
          this.displayChainStats();
          break;
        case 'blocks':
          this.displayRecentBlocks();
          break;
        case 'wallet':
          this.displayWalletInfo();
          break;
        case 'send':
          await this.sendTransaction();
          break;
        case 'mine':
          await this.mineBlock();
          break;
        case 'api':
          await this.startAPIServer();
          return; // Exit interactive mode when API server starts
        case 'validate':
          const isValid = this.blockchain.isChainValid();
          console.log(isValid ? 
            chalk.green('✓ Blockchain is valid') : 
            chalk.red('✗ Blockchain is invalid')
          );
          break;
        case 'exit':
          console.log(chalk.blue('👋 Goodbye!'));
          process.exit(0);
          break;
      }
      
      // Pause before showing menu again
      await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }]);
    }
  }
}

// CLI Commands
program
  .name('glitchnut')
  .description('Glitchnut Cryptocurrency Node')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new Glitchnut blockchain')
  .action(async () => {
    const cli = new GlitchnutCLI();
    await cli.init();
    cli.displayChainStats();
  });

program
  .command('start')
  .description('Start interactive Glitchnut node')
  .action(async () => {
    const cli = new GliitchnutCLI();
    await cli.init();
    await cli.interactiveMode();
  });

program
  .command('api')
  .description('Start API server')
  .option('-p, --port <port>', 'API server port', '3000')
  .option('-w, --ws-port <wsPort>', 'WebSocket port', '3001')
  .action(async (options) => {
    const cli = new GliitchnutCLI();
    await cli.init();
    
    const apiServer = new GlitchnutAPI({
      port: parseInt(options.port),
      wsPort: parseInt(options.wsPort),
      blockchain: {
        dataDir: './glitchnut-data',
        difficulty: 4,
        miningReward: 50
      }
    });

    apiServer.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n' + chalk.yellow('Shutting down...'));
      apiServer.stop();
      process.exit(0);
    });
  });

program
  .command('mine')
  .description('Mine a new block')
  .action(async () => {
    const cli = new GliitchnutCLI();
    await cli.init();
    await cli.mineBlock();
  });

program
  .command('balance <address>')
  .description('Check balance of an address')
  .action(async (address) => {
    const cli = new GliitchnutCLI();
    await cli.init();
    
    const balance = cli.blockchain.getBalanceOfAddress(address);
    console.log(chalk.green(`Balance: ${balance} GNC`));
  });

program
  .command('send <to> <amount>')
  .description('Send Glitchnut to an address')
  .option('-f, --fee <fee>', 'Transaction fee', '0.1')
  .action(async (to, amount, options) => {
    const cli = new GliitchnutCLI();
    await cli.init();
    
    try {
      const transaction = new Transaction(
        cli.defaultWallet.getAddress(),
        to,
        parseFloat(amount),
        parseFloat(options.fee)
      );

      cli.defaultWallet.signTransaction(transaction);
      cli.blockchain.addTransaction(transaction);

      console.log(chalk.green('✓ Transaction added to pending pool'));
      console.log(chalk.gray(`Hash: ${transaction.hash}`));
    } catch (error) {
      console.log(chalk.red('✗ Transaction failed:'), error.message);
    }
  });

program
  .command('wallet')
  .description('Create a new wallet')
  .action(() => {
    const wallet = new Wallet();
    const filename = `wallet-${Date.now()}.json`;
    wallet.save(filename);
    
    console.log(chalk.green('✓ New wallet created'));
    console.log(chalk.gray('Address:'), chalk.white(wallet.getAddress()));
    console.log(chalk.gray('Saved to:'), filename);
  });

program
  .command('stats')
  .description('Show blockchain statistics')
  .action(async () => {
    const cli = new GliitchnutCLI();
    await cli.init();
    cli.displayChainStats();
  });

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str))
});

if (require.main === module) {
  program.parse(process.argv);
}

module.exports = GlitchnutCLI;