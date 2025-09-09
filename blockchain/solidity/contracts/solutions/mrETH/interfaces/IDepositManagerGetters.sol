// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IDelegationManager} from "./../external/interfaces/IDelegationManager.sol";
import {IStrategyFactory} from "./../external/interfaces/IStrategyFactory.sol";
import {IDepositManagerPool} from "./IDepositManagerPool.sol";
import {IDepositManagerTypes} from "./IDepositManagerTypes.sol";

/**
 * @title IDepositManagerGetters
 * @dev Interface for DepositManager getter functions
 */
interface IDepositManagerGetters is IDepositManagerPool {
    /**
     * @dev Gets the Pool data for a specific Pool.
     * @param pool Pool's address.
     * @return poolData Pool data struct.
     */
    function poolData(address pool) external view returns (IDepositManagerTypes.PoolData memory);

    /**
     * @dev Gets an array of all Pools.
     * @return poolsArray Array of Pool addresses.
     */
    function getPoolsArray() external view returns (address[] memory poolsArray);

    /**
     * @dev Gets an array of all operators.
     * @return operatorsArray Array of operator addresses.
     */
    function getOperatorsArray() external view returns (address[] memory operatorsArray);

    /**
     * @dev Gets operator delegators.
     * @param operator Operator's address.
     * @return struct Struct of operator delegators data.
     */
    function operatorsDelegators(
        address operator
    ) external view returns (IDepositManagerTypes.OperatorDelegation memory);

    /**
     * @dev Gets a config struct.
     * @return config Config struct.
     */
    function config() external view returns (IDepositManagerTypes.Config memory);

    /**
     * @dev Gets strategy for a specific token.
     * @param token Token's address.
     * @return tokenData Token data struct.
     */
    function strategies(
        address token
    ) external view returns (IDepositManagerTypes.TokenData memory tokenData);

    /**
     * @dev Gets the strategy's factory address.
     * @return strategyFactory Strategy's factory address.
     */
    // solhint-disable-next-line func-name-mixedcase
    function STRATEGY_FACTORY() external view returns (IStrategyFactory strategyFactory);

    /**
     * @dev Gets WETH's address.
     * @return weth WETH's address.
     */
    // solhint-disable-next-line func-name-mixedcase
    function WETH() external view returns (address weth);

    /**
     * @dev Gets the delegation Manager's address.
     * @return delegationManager Delegation Manager's address.
     */
    // solhint-disable-next-line func-name-mixedcase
    function DELEGATION_MANAGER() external view returns (IDelegationManager delegationManager);

    /**
     * @dev Gets the Reward Coordinator's address.
     * @return rewardsCoordinator Reward Coordinator's address.
     */
    // solhint-disable-next-line func-name-mixedcase
    function REWARDS_COORDINATOR() external view returns (address rewardsCoordinator);
}
