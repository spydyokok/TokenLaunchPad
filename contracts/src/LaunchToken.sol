// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Fixed supply: no owner mint, tax, blacklist, or upgrade authority.
contract LaunchToken is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 supply_, address creator)
        ERC20(name_, symbol_) { _mint(creator, supply_); }
}
