// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {IDelegationManager} from "./external/interfaces/IDelegationManager.sol";
import {IStrategyFactory} from "./external/interfaces/IStrategyFactory.sol";
import {IDepositManagerTypes} from "./interfaces/IDepositManagerTypes.sol";

/// @title Deposit Manager Storage
/// @notice Storage contract for the Deposit Manager contract.
abstract contract DepositManagerStorage is IDepositManagerTypes {
    /// @dev Supply Manager contract's address.
    address public immutable SUPPLY_MANAGER;

    /// @dev WETH Token's address.
    address public immutable WETH;

    /// @dev EigenLayer restaking contract's address.
    IDelegationManager public immutable DELEGATION_MANAGER;

    /// @dev EigenLayer Reward Coordinator contract's address.
    address public immutable REWARDS_COORDINATOR;

    /// @dev EigenLayer strategy factory contract's address.
    IStrategyFactory public immutable STRATEGY_FACTORY;

    /// @dev Authorized Staker and Restaker in EigenLayer.
    address public authorizedStaker;

    /// @dev Address of the minimal proxy clone implementation for the Delegator contract.
    address public delegatorImplementation;

    /// @dev Buffer percentage parameter, where:
    /// `(TVL ETH * bufferPercentage / PERCENTAGE_FACTOR)` is the amount of ETH token staked in the Pools.
    uint16 public bufferPercentage;

    /// @dev Boolean flag indicating whether the `stake` and `delegate` functions are paused.
    bool public isStakePaused;

    /// @dev Array of whitelisted operators for delegation.
    address[] public operatorsArray;

    /// @dev Array of pool contracts.
    address[] public poolsArray;

    /// @dev Mapping of pool data.
    mapping(address pool => PoolData) public poolData;

    /// @dev Mapping of EigenLayer strategies which are not stored in `STRATEGY_FACTORY`.
    mapping(address token => StrategyData) public strategies;

    /// @dev Mapping of operator delegations.
    mapping(address operator => OperatorDelegation) public operatorsDelegators;
}
