// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title AAVE Buffer Library
/// @notice Library for interacting with AAVE lending Pools.
library AaveBufferLib {
    /// @dev Constant for the selector of the the AAVE's `deposit` function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant SUPPLY_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("supply(address,uint256,address,uint16)"));

    /// @dev Constant for the selector of the AAVE's `withdraw` function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant WITHDRAW_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("withdraw(address,uint256,address)"));

    /**
     * @dev Encodes the data for depositing into an AAVE Pool.
     * @param asset Deposit token's address.
     * @param receiver LP token receiver's address.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address asset,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(SUPPLY_SELECTOR, asset, amount, receiver, 0);
    }

    /**
     * @dev Encodes data for withdrawing from an AAVE Pool.
     * @param asset Deposit token's address.
     * @param receiver Address of the LP token receiver.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address asset,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(WITHDRAW_SELECTOR, asset, amount, receiver);
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
