/**
 * Link to the original contract:
 * https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/src/contracts/interfaces/IStrategyFactory.sol
 */
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

import "./IStrategy.sol";

/**
 * @title Interface for the `StrategyFactory` contract.
 * @author Layr Labs, Inc.
 * @notice Terms of Service: https://docs.eigenlayer.xyz/overview/terms-of-service
 * @dev This may not be compatible with non-standard ERC20 tokens. Caution is warranted.
 */
interface IStrategyFactory {
    /// @notice Mapping token => Strategy contract for the token
    /// The strategies in this mapping are deployed by the StrategyFactory.
    /// The factory can only deploy a single strategy per token address
    /// These strategies MIGHT not be whitelisted in the StrategyManager,
    /// though deployNewStrategy does whitelist by default.
    /// These strategies MIGHT not be the only strategy for the underlying token
    /// as additional strategies can be whitelisted by the owner of the factory.
    function deployedStrategies(IERC20 token) external view returns (IStrategy);
}
