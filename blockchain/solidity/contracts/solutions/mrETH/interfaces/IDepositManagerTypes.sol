// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IStrategy} from "../external/interfaces/IStrategy.sol";
import {IStrategyLib} from "./IStrategyLib.sol";

/// @title Deposit Manager Types Interface
/// @notice Defines the structs and enums used in the Deposit Manager contract.
interface IDepositManagerTypes {
    /**
     * @dev Enum representing the possible statuses of an operation.
     */
    enum OperationStatus {
        None, // Operation does not exist.
        Pending, // Operation is pending confirmation.
        Confirmed // Operation is confirmed.
    }

    /**
     * @dev Struct to store the information about a redeem operation.
     * @param value Value associated with the withdrawal operation.
     * @param status Current status of the operation.
     */
    struct RedeemOperationInfo {
        uint256 value;
        OperationStatus status;
    }

    /**
     * @dev Struct to store the yield distribution information for a party.
     * @param party User's address.
     * @param portion Portion of yield allocated to this party.
     */
    struct Party {
        address party;
        uint256 portion;
    }

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
     */
    struct StrategyData {
        IStrategy strategy;
        IStrategyLib strategyLib;
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
}
