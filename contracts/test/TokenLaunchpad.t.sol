// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {MockUSDC} from "../src/MockUSDC.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {TokenSale} from "../src/TokenSale.sol";
interface VmTest {function warp(uint256) external;function prank(address) external;function startPrank(address) external;function stopPrank() external;function expectRevert() external;}
contract TokenLaunchpadTest {
 VmTest constant vm=VmTest(address(uint160(uint256(keccak256("hevm cheat code")))));
 MockUSDC payment;LaunchpadFactory factory;TokenSale sale;LaunchToken token;
 address buyer=address(0xBEEF);address treasury=address(0xCAFE);
 function setUp() public {
  payment=new MockUSDC();factory=new LaunchpadFactory(address(payment),treasury);
  TokenSale.Config memory c=TokenSale.Config(10e18,100e6,200e6,10e6,200e6,uint64(block.timestamp+100),uint64(block.timestamp+1100));
  (address t,address s)=factory.createLaunch("Spydy Token","SPY",1_000_000e18,c);token=LaunchToken(t);sale=TokenSale(s);
  token.approve(s,2000e18);sale.depositSaleTokens();payment.mint(buyer,1000e6);vm.prank(buyer);payment.approve(s,type(uint256).max);
  vm.warp(block.timestamp+100);
 }
 function testSuccessfulClaimAndFee() public {vm.prank(buyer);sale.buyTokens(100e6);vm.warp(block.timestamp+1001);sale.finalizeSale();sale.withdrawUnsoldTokens();require(token.balanceOf(address(sale))==1000e18);vm.prank(buyer);sale.claimTokens();require(token.balanceOf(buyer)==1000e18);sale.withdrawRaisedFunds();require(payment.balanceOf(treasury)==2e6);vm.expectRevert();sale.withdrawRaisedFunds();}
 function testRefundAfterMissedSoftCap() public {vm.prank(buyer);sale.buyTokens(50e6);vm.warp(block.timestamp+1001);sale.finalizeSale();vm.prank(buyer);sale.claimRefund();require(payment.balanceOf(buyer)==1000e6);vm.expectRevert();vm.prank(buyer);sale.claimRefund();vm.expectRevert();sale.withdrawRaisedFunds();}
 function testHardCapEarlyFinalize() public {vm.prank(buyer);sale.buyTokens(200e6);sale.finalizeSale();require(sale.successful());}
 function testDoubleClaimReverts() public {vm.prank(buyer);sale.buyTokens(200e6);sale.finalizeSale();vm.prank(buyer);sale.claimTokens();vm.expectRevert();vm.prank(buyer);sale.claimTokens();}
 function testWalletCap() public {vm.prank(buyer);sale.buyTokens(195e6);vm.expectRevert();vm.prank(buyer);sale.buyTokens(10e6);}
 function testFuzzExactAllocation(uint96 raw) public {uint256 amount=10e6+uint256(raw)%(190e6+1);vm.prank(buyer);sale.buyTokens(amount);require(sale.purchasedTokens(buyer)==amount*10e12);require(sale.totalRaised()==amount);}
 function testFuzzClaimsRemainSolvent(uint96 raw) public {uint256 amount=100e6+uint256(raw)%(100e6+1);vm.prank(buyer);sale.buyTokens(amount);vm.warp(block.timestamp+1001);sale.finalizeSale();sale.withdrawUnsoldTokens();require(token.balanceOf(address(sale))==sale.totalSold()-sale.totalClaimed());vm.prank(buyer);sale.claimTokens();require(token.balanceOf(address(sale))==0);}
 function testFuzzRefundConservesPayment(uint96 raw) public {uint256 amount=10e6+uint256(raw)%(90e6);vm.prank(buyer);sale.buyTokens(amount);vm.warp(block.timestamp+1001);sale.finalizeSale();vm.prank(buyer);sale.claimRefund();require(payment.balanceOf(buyer)==1000e6);require(payment.balanceOf(address(sale))==0);}
}
