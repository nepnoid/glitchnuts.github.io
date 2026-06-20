// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrioReceiptRegistry {
    struct Receipt {
        bytes32 receiptHash;
        string taskId;
        string agentId;
        string actionType;
        string status;
        uint256 createdAt;
    }

    Receipt[] public receipts;

    event ReceiptLogged(
        uint256 indexed id,
        bytes32 indexed receiptHash,
        string taskId,
        string agentId,
        string actionType,
        string status,
        uint256 createdAt
    );

    function logReceipt(
        bytes32 receiptHash,
        string calldata taskId,
        string calldata agentId,
        string calldata actionType,
        string calldata status
    ) external returns (uint256 id) {
        id = receipts.length;
        receipts.push(Receipt({
            receiptHash: receiptHash,
            taskId: taskId,
            agentId: agentId,
            actionType: actionType,
            status: status,
            createdAt: block.timestamp
        }));

        emit ReceiptLogged(id, receiptHash, taskId, agentId, actionType, status, block.timestamp);
    }

    function receiptCount() external view returns (uint256) {
        return receipts.length;
    }
}
