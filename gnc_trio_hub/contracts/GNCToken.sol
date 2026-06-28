// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GNCToken
/// @notice ERC-20 token for the Game Network Coin (GNC) Collaboration Hub.
/// @dev Fixed supply of 21,000,000 GNC. Owner can mint reward tokens to users
///      when they submit receipts through the TrioTaskReceiptsV2 contract.
///      Max reward per receipt: 10 GNC. Total mintable rewards capped at 10,500,000 GNC (50%).
contract GNCToken {

    // --- ERC-20 Standard ---
    string public constant name = "Game Network Coin";
    string public constant symbol = "GNC";
    uint8 public constant decimals = 18;

    uint256 public constant TOTAL_SUPPLY = 21_000_000 * 10**18;
    uint256 public constant REWARD_POOL  = 10_500_000 * 10**18; // 50% for rewards
    uint256 public constant REWARD_PER_RECEIPT = 10 * 10**18;   // 10 GNC per receipt

    uint256 public totalSupply;
    uint256 public rewardsMinted;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;
    address public hubContract; // The TrioTaskReceiptsV2 contract address (authorized minter)

    // --- Events ---
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event RewardMinted(address indexed recipient, uint256 amount, uint256 receiptId);
    event HubContractSet(address indexed hubContract);

    // --- Modifiers ---
    modifier onlyOwner() { require(msg.sender == owner, 'not owner'); _; }
    modifier onlyHub() { require(msg.sender == hubContract || msg.sender == owner, 'not hub'); _; }

    // --- Constructor ---
    constructor() {
        owner = msg.sender;
        // Mint founder allocation (50%) to owner
        uint256 founderAlloc = TOTAL_SUPPLY - REWARD_POOL;
        totalSupply = founderAlloc;
        balanceOf[msg.sender] = founderAlloc;
        emit Transfer(address(0), msg.sender, founderAlloc);
    }

    // --- Owner: Set the authorized hub contract address ---
    function setHubContract(address _hub) external onlyOwner {
        require(_hub != address(0), 'zero address');
        hubContract = _hub;
        emit HubContractSet(_hub);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), 'zero address');
        owner = newOwner;
    }

    // --- Reward Minting: Called by hub when a receipt is created ---
    function mintReward(address recipient, uint256 receiptId) external onlyHub {
        require(recipient != address(0), 'zero address');
        require(rewardsMinted + REWARD_PER_RECEIPT <= REWARD_POOL, 'reward pool exhausted');
        rewardsMinted += REWARD_PER_RECEIPT;
        totalSupply += REWARD_PER_RECEIPT;
        balanceOf[recipient] += REWARD_PER_RECEIPT;
        emit Transfer(address(0), recipient, REWARD_PER_RECEIPT);
        emit RewardMinted(recipient, REWARD_PER_RECEIPT, receiptId);
    }

    // --- ERC-20 Standard Functions ---
    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), 'zero address');
        require(balanceOf[msg.sender] >= amount, 'insufficient balance');
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), 'zero address');
        require(balanceOf[from] >= amount, 'insufficient balance');
        require(allowance[from][msg.sender] >= amount, 'insufficient allowance');
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // --- View helpers ---
    function remainingRewardPool() external view returns (uint256) {
        return REWARD_POOL - rewardsMinted;
    }
}
