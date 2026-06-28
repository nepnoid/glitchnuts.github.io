// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TrioTaskReceiptsV2
/// @notice Multi-user receipt ledger for the GNC Collaboration Hub.
/// @dev Any wallet can submit tasks and write receipts. Owner can update status on behalf of the Hub.
///      Keeps sensitive task content off-chain; only hashes are stored on-chain.
contract TrioTaskReceiptsV2 {

    address public owner;

    enum Status {
        Created,
        SentToGemini,
        SentToManus,
        Running,
        Completed,
        Failed,
        Cancelled
    }

    struct Receipt {
        bytes32 taskHash;
        bytes32 offchainPointerHash;
        Status status;
        address submitter;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // --- Storage ---
    uint256 public nextReceiptId = 1;
    mapping(uint256 => Receipt) public receipts;

    // User registry: wallet => list of receipt IDs they submitted
    mapping(address => uint256[]) public userReceipts;

    // User receipt count
    mapping(address => uint256) public userReceiptCount;

    // Total unique users
    address[] public registeredUsers;
    mapping(address => bool) public isRegistered;

    // --- Events ---
    event ReceiptCreated(
        uint256 indexed receiptId,
        bytes32 indexed taskHash,
        bytes32 indexed offchainPointerHash,
        address submitter,
        uint256 timestamp
    );

    event ReceiptStatusUpdated(
        uint256 indexed receiptId,
        Status indexed status,
        bytes32 indexed statusHash,
        uint256 timestamp
    );

    event UserRegistered(address indexed user, uint256 timestamp);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, 'not owner');
        _;
    }

    modifier onlySubmitterOrOwner(uint256 receiptId) {
        require(
            msg.sender == receipts[receiptId].submitter || msg.sender == owner,
            'not submitter or owner'
        );
        _;
    }

    // --- Constructor ---
    constructor() {
        owner = msg.sender;
    }

    // --- Owner Management ---
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), 'zero address');
        owner = newOwner;
    }

    // --- Core: Create Receipt (open to all wallets) ---
    function createReceipt(bytes32 taskHash, bytes32 offchainPointerHash)
        external
        returns (uint256 receiptId)
    {
        require(taskHash != bytes32(0), 'empty task hash');

        // Register user if first time
        if (!isRegistered[msg.sender]) {
            isRegistered[msg.sender] = true;
            registeredUsers.push(msg.sender);
            emit UserRegistered(msg.sender, block.timestamp);
        }

        receiptId = nextReceiptId++;
        receipts[receiptId] = Receipt({
            taskHash: taskHash,
            offchainPointerHash: offchainPointerHash,
            status: Status.Created,
            submitter: msg.sender,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        userReceipts[msg.sender].push(receiptId);
        userReceiptCount[msg.sender]++;

        emit ReceiptCreated(receiptId, taskHash, offchainPointerHash, msg.sender, block.timestamp);
    }

    // --- Status Update: Owner or original submitter can update ---
    function updateStatus(uint256 receiptId, Status status, bytes32 statusHash)
        external
        onlySubmitterOrOwner(receiptId)
    {
        Receipt storage receipt = receipts[receiptId];
        require(receipt.createdAt != 0, 'missing receipt');
        receipt.status = status;
        receipt.updatedAt = block.timestamp;
        emit ReceiptStatusUpdated(receiptId, status, statusHash, block.timestamp);
    }

    // --- Explorer: Get all receipt IDs for a given wallet ---
    function getReceiptsByUser(address user)
        external
        view
        returns (uint256[] memory)
    {
        return userReceipts[user];
    }

    // --- Explorer: Get total number of registered users ---
    function getTotalUsers() external view returns (uint256) {
        return registeredUsers.length;
    }

    // --- Explorer: Get total receipts ever created ---
    function getTotalReceipts() external view returns (uint256) {
        return nextReceiptId - 1;
    }

    // --- Explorer: Get a page of recent receipts (newest first) ---
    function getRecentReceipts(uint256 count)
        external
        view
        returns (uint256[] memory ids)
    {
        uint256 total = nextReceiptId - 1;
        uint256 size = count > total ? total : count;
        ids = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            ids[i] = total - i;
        }
    }
}
