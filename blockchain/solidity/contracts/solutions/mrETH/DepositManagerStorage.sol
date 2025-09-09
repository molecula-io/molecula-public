// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IDelegationManager} from "./external/interfaces/IDelegationManager.sol";
import {IStrategyFactory} from "./external/interfaces/IStrategyFactory.sol";
import {IDepositManagerTypes} from "./interfaces/IDepositManagerTypes.sol";

/// @title Deposit Manager Storage.
/// @notice Storage contract for the Deposit Manager contract.
abstract contract DepositManagerStorage is IDepositManagerTypes {
    // slither-disable-start uninitialized-state
    /// @dev Role for the authorized staker.
    bytes32 public constant AUTHORIZED_STAKER_ROLE = keccak256("AUTHORIZED_STAKER_ROLE");

    /// @dev Supply Manager contract's address.
    address public immutable SUPPLY_MANAGER;

    /// @dev EigenLayer restaking contract's address.
    IDelegationManager public immutable DELEGATION_MANAGER;

    /// @dev EigenLayer Reward Coordinator contract's address.
    address public immutable REWARDS_COORDINATOR;

    /// @dev EigenLayer strategy factory contract's address.
    IStrategyFactory public immutable STRATEGY_FACTORY;

    /// @dev Deposit Manager Restaker contract's address.
    /// @notice This contract is used for the restaking functionality of EigenLayer.
    address public immutable DEPOSIT_MANAGER_RESTAKER;

    /// @dev WETH contract's address.
    address public immutable WETH;

    /// @dev Configuration variables struct for the Deposit Manager.
    Config public config;

    /// @dev Array of whitelisted operators for delegation.
    address[] internal _operatorsArray;

    /// @dev Array of pool contracts.
    address[] internal _poolsArray;

    /// @dev Mapping of pool data.
    mapping(address pool => PoolData) public poolData;

    /// @dev Mapping of EigenLayer strategies which are not stored in `STRATEGY_FACTORY`.
    mapping(address token => TokenData) public strategies;

    /// @dev Mapping of operator delegations.
    mapping(address operator => OperatorDelegation) public operatorsDelegators;
    // slither-disable-end uninitialized-state
}
