// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICompoundAssetDataProvider} from "./../external/interfaces/ICompoundAssetDataProvider.sol";

/// @title Compound Buffer Library
/// @notice Library for interacting with Compound lending pools.
library CompoundBufferLib {
    /// @dev Constant for the selector of Compound's `deposit` function.
    bytes4 internal constant COMPOUND_SUPPLY_SELECTOR =
        bytes4(keccak256("supply(address,uint256)"));

    /// @dev Constant for the selector of Compound's withdraw function.
    bytes4 internal constant COMPOUND_WITHDRAW_SELECTOR =
        bytes4(keccak256("withdraw(address,uint256)"));

    /// @dev Constant for the symbol of WETH.
    bytes32 internal constant WETH_SYMBOL = keccak256(bytes("WETH"));

    /**
     * @dev Encodes data for depositing into a Compound Pool.
     * @param token Deposit token's address.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address token,
        address,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(COMPOUND_SUPPLY_SELECTOR, token, amount);
    }

    /**
     * @dev Encodes data for withdrawing from a Compound Pool.
     * @param token Deposit token's address.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address token,
        address,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(COMPOUND_WITHDRAW_SELECTOR, token, amount);
    }

    /**
     * @dev Gets the withdrawable ETH balance.
     * @param token Deposit token's address.
     * @param owner LP token owner's address.
     * @return uint256 Withdrawable ETH balance.
     */
    function getEthBalance(address, address token, address owner) external view returns (uint256) {
        return IERC20(token).balanceOf(owner);
    }

    /**
     * @dev Gets the available amount to deposit into a Compound Pool.
     * @param token Deposit token's address.
     * @param poolToken Pool token's address.
     * @return uint256 Available amount to deposit.
     */
    function getAvailableAmountToDeposit(
        address,
        address token,
        address poolToken
    ) external view returns (uint256) {
        // WETH token don't have supply cap.
        if (keccak256(bytes(IERC20Metadata(token).symbol())) == WETH_SYMBOL) {
            return type(uint256).max;
        }

        // Get supply cap of token.
        uint256 supplyCap = ICompoundAssetDataProvider(poolToken)
            .getAssetInfoByAddress(token)
            .supplyCap;

        // Get actual supply of token in pool.
        uint256 totalSupply = ICompoundAssetDataProvider(poolToken)
            .totalsCollateral(token)
            .totalSupplyAsset;

        // Return available amount to deposit, if supply cap is reached, return 0.
        unchecked {
            return supplyCap > totalSupply ? supplyCap - totalSupply : 0;
        }
    }
}
