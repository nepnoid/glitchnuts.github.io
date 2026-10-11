// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice GNC testnet token. Do not deploy this contract for production value without review.
contract GNC {
    string public constant name = "GlitchNut Coin";
    string public constant symbol = "GNC";
    uint8 public constant decimals = 18;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether;

    uint256 public totalSupply;
    address public immutable owner;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed tokenOwner, address indexed spender, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "GNC: owner only");
        _;
    }

    constructor(address initialHolder, uint256 initialSupply) {
        require(initialHolder != address(0), "GNC: zero holder");
        require(initialSupply <= MAX_SUPPLY, "GNC: cap exceeded");
        owner = msg.sender;
        _mint(initialHolder, initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "GNC: allowance exceeded");
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply + amount <= MAX_SUPPLY, "GNC: cap exceeded");
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "GNC: zero recipient");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "GNC: zero recipient");
        require(balanceOf[from] >= amount, "GNC: balance too low");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
