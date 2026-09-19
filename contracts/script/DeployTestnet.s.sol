// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {MockUSDC} from "../src/MockUSDC.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
interface VmDeploy { function envAddress(string calldata) external returns(address); function startBroadcast() external; function stopBroadcast() external; }
contract DeployTestnet {
    VmDeploy constant vm=VmDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));
    event Deployed(address payment,address factory,address treasury);
    function run() external {
        require(block.chainid == 11155111, "Sepolia only; do not use test faucet on mainnet");
        address treasury=vm.envAddress("TREASURY");
        vm.startBroadcast();
        MockUSDC payment=new MockUSDC();
        LaunchpadFactory factory=new LaunchpadFactory(address(payment),treasury);
        payment.mint(treasury,100_000e6);
        vm.stopBroadcast();
        emit Deployed(address(payment),address(factory),treasury);
    }
}
