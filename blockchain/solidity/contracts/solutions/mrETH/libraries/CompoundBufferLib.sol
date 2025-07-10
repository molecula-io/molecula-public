// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Compound Buffer Library
/// @notice Library for interacting with Compound lending pools.
library CompoundBufferLib {
    /// @dev Constant for the selector of Compound's `deposit` function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant COMPOUND_SUPPLY_SELECTOR =
        bytes4(keccak256("supply(address,uint256)"));

    /// @dev Constant for the selector of Compound's withdraw function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant COMPOUND_WITHDRAW_SELECTOR =
        bytes4(keccak256("withdraw(address,uint256)"));

    /**
     * @dev Encodes data for depositing into a Compound Pool.
     * @param asset Deposit token's address.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address asset,
        address,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(COMPOUND_SUPPLY_SELECTOR, asset, amount);
    }

    /**
     * @dev Encodes data for withdrawing from a Compound Pool.
     * @param asset Deposit token's address.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address asset,
        address,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(COMPOUND_WITHDRAW_SELECTOR, asset, amount);
    }

    /**
     * @dev Gets the withdrawable ETH balance.
     * @param asset Deposit token's address.
     * @param owner LP token owner's address.
     * @return uint256 Withdrawable ETH balance.
     */
    function getEthBalance(address, address asset, address owner) external view returns (uint256) {
        return IERC20(asset).balanceOf(owner);
    }
}
