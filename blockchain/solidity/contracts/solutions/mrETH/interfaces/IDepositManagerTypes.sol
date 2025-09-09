// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IStrategy} from "./../external/interfaces/IStrategy.sol";
import {IDepositManagerLib} from "./IDepositManagerLib.sol";
import {IStrategyLib} from "./IStrategyLib.sol";

/// @title Deposit Manager Types Interface.
/// @notice Defines the structs and enums used in the Deposit Manager contract.
interface IDepositManagerTypes {
    /**
     * @dev Struct to store pool configuration data.
     * @param poolToken Address of the pool's rebase token.
     * @param poolLib Address of the pool's interactor library.
     * @param poolPortion Percentage of funds allocated to this pool.
     * @param poolId Index of the pool in the poolsArray.
     */
    struct PoolData {
        address poolToken;
        address poolLib;
        uint16 poolPortion;
        uint64 poolId;
    }

    /**
     * @dev Struct to set the data of pools.
     * @param pool Pool addresses.
     * @param auth Boolean flag indicating for adding or removing the pool.
     * @param newPoolData New PoolData.
     */
    struct SetPoolData {
        address pool;
        bool auth;
        PoolData newPoolData;
    }

    /**
     * @dev Struct to store the strategy-related data.
     * @param strategy EigenLayer strategy contract.
     * @param strategyLib Library for interacting with the strategy.
     * @param requestedRedeemAssets Value to redeem in the token amount.
     */
    struct TokenData {
        IStrategy strategy;
        IStrategyLib strategyLib;
        uint256 requestedRedeemAssets;
    }

    /**
     * @dev Struct to store the operator delegation information.
     * @param delegator Address of the delegator contract.
     * @param delegationPortion Percentage of delegation allocated to this operator.
     */
    struct OperatorDelegation {
        address delegator;
        uint64 delegationPortion;
    }

    /**
     * @dev Struct to store the configuration data.
     * @param depositManagerLib External library for `DepositManager` calculations.
     * @param moleculaBuffer Molecula buffer for unlimited deposits.
     * @param delegatorImplementation Address of the minimal proxy clone implementation for the Delegator contract.
     * @param bufferPercentage Buffer percentage parameter, where:
     * `(TVL ETH * bufferPercentage / PERCENTAGE_FACTOR)` is the amount of ETH token staked in the Pools.
     * @param minFeePercentage Minimum fee percentage.
     * @param maxFeePercentage Maximum fee percentage.
     */
    // solhint-disable-next-line gas-struct-packing
    struct Config {
        address moleculaBuffer;
        address delegatorImplementation;
        IDepositManagerLib depositManagerLib;
        uint16 bufferPercentage;
        uint16 minFeePercentage;
        uint16 maxFeePercentage;
    }
}
