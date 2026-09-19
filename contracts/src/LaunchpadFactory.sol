// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {LaunchToken} from "./LaunchToken.sol";
import {TokenSale} from "./TokenSale.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract LaunchpadFactory {
    address public immutable paymentToken;
    address public immutable treasury;
    uint256 public constant feeBps = 200;
    address[] public sales;
    event LaunchCreated(address indexed creator,address indexed token,address indexed sale,string name,string symbol);
    error InvalidInput();
    constructor(address payment_,address treasury_) {
        if(treasury_ == address(0) || payment_.code.length == 0 || IERC20Metadata(payment_).decimals() != 6) revert InvalidInput();
        paymentToken=payment_; treasury=treasury_;
    }
    function createLaunch(string calldata name,string calldata symbol,uint256 supply,TokenSale.Config calldata config) external returns(address token,address sale) {
        if(bytes(name).length == 0 || bytes(name).length > 48 || bytes(symbol).length == 0 || bytes(symbol).length > 10 || supply == 0) revert InvalidInput();
        token=address(new LaunchToken(name,symbol,supply,msg.sender));
        sale=address(new TokenSale(token,paymentToken,msg.sender,treasury,feeBps,config));
        sales.push(sale); emit LaunchCreated(msg.sender,token,sale,name,symbol);
    }
    function saleCount() external view returns(uint256) { return sales.length; }
    function getSales(uint256 offset,uint256 limit) external view returns(address[] memory result) {
        if(limit > 50) revert InvalidInput();
        if(offset >= sales.length) return new address[](0);
        uint256 end=offset+limit; if(end>sales.length) end=sales.length;
        result=new address[](end-offset);
        for(uint256 i=offset;i<end;i++) result[i-offset]=sales[i];
    }
}
