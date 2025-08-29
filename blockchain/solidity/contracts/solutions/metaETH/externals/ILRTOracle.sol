// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/**
 * Link to the original contract:
 * https://github.com/Kelp-DAO/LRT-rsETH/blob/main/contracts/LRTOracle.sol#L20
 */

/// @title ILRTOracle Interface.
/// @dev Interface for interacting with the LRT Oracle contract that provides rsETH price information.
interface ILRTOracle {
    /// @dev Gets the current price of rsETH.
    /// @return The current price of rsETH in terms of ETH (scaled by 1e18).
    function rsETHPrice() external view returns (uint256);
}
