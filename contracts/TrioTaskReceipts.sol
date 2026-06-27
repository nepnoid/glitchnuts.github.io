// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TrioTaskReceipts
/// @notice Minimal receipt ledger for a Gemini-Manus-GNC collaboration hub.
/// @dev Store hashes and status events on-chain; keep sensitive task content off-chain.
contract TrioTaskReceipts {
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

    uint256 public nextReceiptId = 1;
    mapping(uint256 => Receipt) public receipts;

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

    modifier onlyOwner() {
        require(msg.sender == owner, 'not owner');
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), 'zero address');
        owner = newOwner;
    }

    function createReceipt(bytes32 taskHash, bytes32 offchainPointerHash) external returns (uint256 receiptId) {
        require(taskHash != bytes32(0), 'empty task hash');
        receiptId = nextReceiptId++;
        receipts[receiptId] = Receipt({
            taskHash: taskHash,
            offchainPointerHash: offchainPointerHash,
            status: Status.Created,
            submitter: msg.sender,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        emit ReceiptCreated(receiptId, taskHash, offchainPointerHash, msg.sender, block.timestamp);
    }

    function updateStatus(uint256 receiptId, Status status, bytes32 statusHash) external onlyOwner {
        Receipt storage receipt = receipts[receiptId];
        require(receipt.createdAt != 0, 'missing receipt');
        receipt.status = status;
        receipt.updatedAt = block.timestamp;
        emit ReceiptStatusUpdated(receiptId, status, statusHash, block.timestamp);
    }
}
