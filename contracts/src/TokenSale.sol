// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Fixed-price presale. Payment asset must be a trusted standard 6-decimal ERC20.
/// @dev No fee-on-transfer or rebasing assets. All values use base units.
contract TokenSale is ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Config { uint256 rate; uint256 softCap; uint256 hardCap; uint256 minBuy; uint256 maxBuy; uint64 start; uint64 end; }
    IERC20 public immutable token;
    IERC20 public immutable paymentToken;
    address public immutable creator;
    address public immutable treasury;
    uint256 public immutable feeBps;
    uint256 public immutable inventoryRequired;
    Config public config;
    bool public funded;
    bool public finalized;
    bool public successful;
    bool public proceedsWithdrawn;
    uint256 public totalRaised;
    uint256 public totalSold;
    uint256 public totalClaimed;
    mapping(address => uint256) public contributions;
    mapping(address => uint256) public purchasedTokens;
    mapping(address => bool) public claimed;
    mapping(address => bool) public refunded;
    error InvalidConfig(); error Unauthorized(); error InvalidState(); error InvalidAmount(); error UnsupportedToken();
    event Funded(uint256 amount);
    event TokensPurchased(address indexed buyer, uint256 payment, uint256 allocation);
    event Finalized(bool successful, uint256 raised);
    event TokensClaimed(address indexed buyer, uint256 amount);
    event RefundClaimed(address indexed buyer, uint256 amount);
    event ProceedsWithdrawn(uint256 creatorAmount, uint256 fee);
    event UnsoldRecovered(uint256 amount);
    constructor(address token_, address payment_, address creator_, address treasury_, uint256 fee_, Config memory c) {
        if (token_ == address(0) || payment_ == address(0) || creator_ == address(0) || treasury_ == address(0)
            || token_ == payment_ || fee_ > 500 || c.rate == 0 || c.softCap == 0 || c.hardCap < c.softCap
            || c.minBuy == 0 || c.maxBuy < c.minBuy || c.maxBuy > c.hardCap || c.start <= block.timestamp || c.end <= c.start) revert InvalidConfig();
        token = IERC20(token_); paymentToken = IERC20(payment_); creator = creator_; treasury = treasury_; feeBps = fee_; config = c;
        inventoryRequired = Math.mulDiv(c.hardCap, c.rate, 1e6);
        if (inventoryRequired == 0 || inventoryRequired > token.totalSupply()) revert InvalidConfig();
    }
    function quote(uint256 amount) public view returns(uint256) { return Math.mulDiv(amount, config.rate, 1e6); }
    function depositSaleTokens() external nonReentrant {
        if(msg.sender != creator) revert Unauthorized();
        if(funded || finalized || block.timestamp >= config.start) revert InvalidState();
        funded = true;
        token.safeTransferFrom(msg.sender, address(this), inventoryRequired);
        emit Funded(inventoryRequired);
    }
    function buyTokens(uint256 amount) external nonReentrant {
        Config memory c = config;
        if(!funded || finalized || block.timestamp < c.start || block.timestamp >= c.end) revert InvalidState();
        if(amount < c.minBuy || contributions[msg.sender] + amount > c.maxBuy || totalRaised + amount > c.hardCap) revert InvalidAmount();
        uint256 allocation = quote(amount);
        if(allocation == 0) revert InvalidAmount();
        contributions[msg.sender] += amount; purchasedTokens[msg.sender] += allocation;
        totalRaised += amount; totalSold += allocation;
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        if(paymentToken.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedToken();
        emit TokensPurchased(msg.sender, amount, allocation);
    }
    function finalizeSale() external {
        if(finalized || (block.timestamp < config.end && totalRaised < config.hardCap)) revert InvalidState();
        finalized = true; successful = funded && totalRaised >= config.softCap;
        emit Finalized(successful,totalRaised);
    }
    function claimTokens() external nonReentrant {
        if(!finalized || !successful || claimed[msg.sender]) revert InvalidState();
        uint256 amount = purchasedTokens[msg.sender];
        if(amount == 0) revert InvalidAmount();
        claimed[msg.sender] = true; totalClaimed += amount;
        token.safeTransfer(msg.sender,amount); emit TokensClaimed(msg.sender,amount);
    }
    function claimRefund() external nonReentrant {
        if(!finalized || successful || refunded[msg.sender]) revert InvalidState();
        uint256 amount = contributions[msg.sender];
        if(amount == 0) revert InvalidAmount();
        refunded[msg.sender] = true;
        paymentToken.safeTransfer(msg.sender,amount); emit RefundClaimed(msg.sender,amount);
    }
    function withdrawRaisedFunds() external nonReentrant {
        if(msg.sender != creator) revert Unauthorized();
        if(!finalized || !successful || proceedsWithdrawn) revert InvalidState();
        proceedsWithdrawn = true;
        uint256 fee = Math.mulDiv(totalRaised,feeBps,10000);
        paymentToken.safeTransfer(treasury,fee);
        paymentToken.safeTransfer(creator,totalRaised-fee);
        emit ProceedsWithdrawn(totalRaised-fee,fee);
    }
    function withdrawUnsoldTokens() external nonReentrant {
        if(msg.sender != creator) revert Unauthorized();
        if(!finalized) revert InvalidState();
        uint256 reserved = successful ? totalSold-totalClaimed : 0;
        uint256 amount = token.balanceOf(address(this))-reserved;
        if(amount == 0) revert InvalidAmount();
        token.safeTransfer(creator,amount); emit UnsoldRecovered(amount);
    }
}
