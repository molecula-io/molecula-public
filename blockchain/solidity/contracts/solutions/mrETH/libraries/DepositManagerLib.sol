// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ConstantsCoreV2} from "./../../../coreV2/Constants.sol";
import {IStrategy} from "./../external/interfaces/IStrategy.sol";
import {IStrategyFactory} from "./../external/interfaces/IStrategyFactory.sol";
import {IBufferInteractor} from "./../interfaces/IBufferInteractor.sol";
import {IDelegator} from "./../interfaces/IDelegator.sol";
import {IDepositManagerGetters} from "./../interfaces/IDepositManagerGetters.sol";
import {IDepositManagerTypes} from "./../interfaces/IDepositManagerTypes.sol";

/**
 * @title DepositManagerLib.
 * @dev External library for `DepositManager` calculations and view functions.
 */
library DepositManagerLib {
    /// @dev Error for cases where the balance before is less than the value.
    error EBalanceBeforeLessThanValue();

    /// @dev Error for cases where the operator list is empty.
    error EOperatorNotExists();

    /**
     * @dev Calculates available amounts to deposit for each Pool.
     * @param depositManager `DepositManager`'s address.
     * @return availableAmounts Array of available amounts for each Pool.
     * @return totalAvailableAmount Total available amount across all Pools.
     */
    function getAvailableAmountToDeposit(
        address depositManager
    ) external view returns (uint256[] memory availableAmounts, uint256 totalAvailableAmount) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);
        address[] memory poolsArray = getters.getPoolsArray();
        address weth = getters.WETH();

        uint256 length = poolsArray.length;
        availableAmounts = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
            address pool = poolsArray[i];
            // Access `poolData` through the getter function.
            IDepositManagerTypes.PoolData memory _poolData = getters.poolData(pool);

            // Get the available amount to deposit for each Pool.
            availableAmounts[i] = IBufferInteractor(_poolData.poolLib).getAvailableAmountToDeposit(
                pool,
                weth,
                _poolData.poolToken
            );

            // Increment `totalAvailableAmount` for each Pool. If it's reached the maximum value, set it to the maximum value.
            if (totalAvailableAmount != type(uint256).max) {
                if (availableAmounts[i] != type(uint256).max) {
                    totalAvailableAmount += availableAmounts[i];
                } else {
                    totalAvailableAmount = type(uint256).max;
                }
            }
        }
    }

    /**
     * @dev Calculates the total buffered supply across all Pools.
     * @param depositManager `DepositManager`'s address.
     * @return totalBuffered Total buffered supply.
     * @return bufferedTVLs Array of the buffered TVL for each Pool.
     */
    function getTotalBufferedSupply(
        address depositManager
    ) public view returns (uint256 totalBuffered, uint256[] memory bufferedTVLs) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);
        address[] memory poolsArray = getters.getPoolsArray();
        address moleculaBuffer = getters.config().moleculaBuffer;

        uint256 length = poolsArray.length;
        bufferedTVLs = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
            address pool = poolsArray[i];
            // Access `poolData` through the getter function.
            IDepositManagerTypes.PoolData memory _poolData = getters.poolData(pool);

            // Get the Pool's balance.
            bufferedTVLs[i] = IBufferInteractor(_poolData.poolLib).getEthBalance(
                pool,
                _poolData.poolToken,
                depositManager
            );

            // Increment the total buffered supply.
            totalBuffered += bufferedTVLs[i];
        }

        // Increment the total buffered supply by the balance of the Molecula Buffer.
        totalBuffered += IBufferInteractor(moleculaBuffer).getEthBalance(
            moleculaBuffer,
            moleculaBuffer,
            moleculaBuffer
        );
    }

    /**
     * @dev Calculates the total restaked supply across all operators.
     * @param depositManager `DepositManager`'s address.
     * @return restakedTVL Total restaked TVL.
     * @return operatorDelegatorTVLs Array of operator Delegator TVLs.
     */
    function getTotalRestakedSupply(
        address depositManager
    ) public view returns (uint256 restakedTVL, uint256[] memory operatorDelegatorTVLs) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);
        address[] memory operatorsArray = getters.getOperatorsArray();

        uint256 operatorsLength = operatorsArray.length;
        operatorDelegatorTVLs = new uint256[](operatorsLength);

        // Get the restaked TVL for each operator.
        for (uint256 i = 0; i < operatorsLength; ++i) {
            // Get the operator and Delegator addresses.
            address operator = operatorsArray[i];
            address delegator = getters.operatorsDelegators(operator).delegator;

            // Get the Delegator ETH supply.
            uint256 operatorEthBalance = IDelegator(delegator).delegatorSupply();

            // Increment the restaked TVL.
            restakedTVL += operatorEthBalance;
            operatorDelegatorTVLs[i] = operatorEthBalance;
        }
    }

    /**
     * @dev Calculates deposit amounts for pools based on portions.
     * @param value Total amount to deposit.
     * @param availableAmounts Array of available amounts for each Pool.
     * @notice `availableAmounts` in the sum must be greater than or equal to `value`.
     * @param depositManager `DepositManager`'s address.
     * @return depositAmounts Array of deposit amounts for each Pool.
     * @return remainingValue Remaining value after deposits to deposit to the Molecula Buffer.
     */
    function calculateDepositAmounts(
        uint256 value,
        uint256[] calldata availableAmounts,
        address depositManager
    ) external view returns (uint256[] memory depositAmounts, uint256 remainingValue) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);
        address[] memory poolsArray = getters.getPoolsArray();

        uint256 length = poolsArray.length;
        depositAmounts = new uint256[](length);
        remainingValue = value;

        // If there is only one Pool, deposit the entire value.
        if (length == 1) {
            // Get the deposit amount for the Pool.
            uint256 depositAmount = value < availableAmounts[0] ? value : availableAmounts[0];
            depositAmounts[0] = depositAmount;
            remainingValue -= depositAmount;
        } else {
            // Get the total buffered supply.
            (uint256 bufferTvl, ) = getTotalBufferedSupply(depositManager);

            for (uint256 i = 0; i < length && remainingValue > 0; ++i) {
                // Access `poolData` through the getter function.
                IDepositManagerTypes.PoolData memory _poolData = getters.poolData(poolsArray[i]);

                if (_poolData.poolPortion > 0) {
                    // Get the Pool's balance.
                    uint256 poolTvl = IBufferInteractor(_poolData.poolLib).getEthBalance(
                        poolsArray[i],
                        _poolData.poolToken,
                        depositManager
                    );

                    unchecked {
                        // Get the required TVL for the Pool by its portion.
                        uint256 requiredTvl = ((bufferTvl + value) * _poolData.poolPortion) /
                            ConstantsCoreV2.PERCENTAGE_FACTOR;

                        // If the Pool's TVL is less than the required one, calculate the maximum deposit to the Pool.
                        if (poolTvl < requiredTvl) {
                            uint256 maxDepositToPool = availableAmounts[i];

                            // Get the deposit amount for the Pool.
                            uint256 depositAmount = remainingValue < maxDepositToPool
                                ? remainingValue
                                : maxDepositToPool;

                            // Set the deposit amount for the Pool.
                            depositAmounts[i] = depositAmount;
                            remainingValue -= depositAmount;
                        }
                    }
                }
            }
        }
    }

    /**
     * @dev Calculates withdrawal amounts for Pools based on portions.
     * @param value Total amount to withdraw.
     * @param bufferedTvl Total buffered TVL.
     * @notice `bufferedTVL` must be greater than or equal to `value`.
     * @param bufferedTvls Array of buffered TVL for each Pool.
     * @param depositManager `DepositManager`'s address.
     * @return withdrawalAmounts Array of withdrawal amounts for each Pool.
     * @return remainingValue Remaining value after withdrawals.
     */
    function calculateWithdrawalAmounts(
        uint256 value,
        uint256 bufferedTvl,
        uint256[] calldata bufferedTvls,
        address depositManager
    ) external view returns (uint256[] memory withdrawalAmounts, uint256 remainingValue) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);
        address[] memory poolsArray = getters.getPoolsArray();

        uint256 length = poolsArray.length;
        withdrawalAmounts = new uint256[](length);
        remainingValue = value;

        // If there is only one Pool, withdraw the entire value.
        if (length == 1) {
            // Set the withdrawal amount for the Pool.
            withdrawalAmounts[0] = remainingValue;
            remainingValue = 0;
        } else {
            for (uint256 i = 0; i < length && remainingValue > 0; ++i) {
                // Access `poolData` through the getter function.
                IDepositManagerTypes.PoolData memory _poolData = getters.poolData(poolsArray[i]);

                // Check if the Pool portion is greater than 0 and the buffered TVL is greater than 0.
                if (_poolData.poolPortion > 0 && bufferedTvls[i] > 0) {
                    unchecked {
                        // Get the target TVL for the Pool by its portion.
                        uint256 targetTvl = ((bufferedTvl - value) * _poolData.poolPortion) /
                            ConstantsCoreV2.PERCENTAGE_FACTOR;

                        // Get the Pool's current TVL.
                        uint256 currentTvl = bufferedTvls[i];

                        // Get the maximum withdrawal from the Pool.
                        uint256 maxWithdrawFromPool = currentTvl > targetTvl
                            ? currentTvl - targetTvl
                            : 0;

                        // If the max withdrawal from the Pool is greater than 0, calculate the withdrawal amount for the Pool.
                        if (maxWithdrawFromPool > 0) {
                            // Get the withdrawal amount for the Pool.
                            uint256 withdrawAmount = remainingValue < maxWithdrawFromPool
                                ? remainingValue
                                : maxWithdrawFromPool;

                            // If the withdrawal amount is greater than 0, set the withdrawal amount for the Pool.
                            if (withdrawAmount > 0) {
                                withdrawalAmounts[i] = withdrawAmount;
                                remainingValue -= withdrawAmount;
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * @dev Calculates the total supply (buffered + restaked).
     * @param depositManager `DepositManager`'s address.
     * @return totalSupplyValue Total supply.
     */
    function totalSupply(address depositManager) external view returns (uint256 totalSupplyValue) {
        (uint256 bufferedTvl, ) = getTotalBufferedSupply(depositManager);
        (uint256 restakedTvl, ) = getTotalRestakedSupply(depositManager);

        totalSupplyValue = bufferedTvl + restakedTvl;
    }

    /**
     * @dev Chooses the best Delegator for the deposit based on the TVL distribution.
     * @param restakedTvl Total restaked TVL.
     * @param operatorDelegatorTVLs Array of operator Delegator TVLs.
     * @param depositManager `DepositManager`'s address.
     * @return delegator Chosen delegator's address.
     */
    function chooseDelegatorForDeposit(
        uint256 restakedTvl,
        uint256[] calldata operatorDelegatorTVLs,
        address depositManager
    ) external view returns (address delegator) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);
        address[] memory operatorsArray = getters.getOperatorsArray();
        uint256 length = operatorsArray.length;

        // Ensure the operator list is not empty.
        if (operatorsArray.length == 0) revert EOperatorNotExists();

        // If there is only one operator, return the Delegator's address.
        if (length == 1) {
            return getters.operatorsDelegators(operatorsArray[0]).delegator;
        }

        uint256 tvlLength = operatorDelegatorTVLs.length;
        for (uint256 i = 0; i < tvlLength; ++i) {
            // Get the operator and Delegator addresses.
            address operator = operatorsArray[i];
            address delegatorAddr = getters.operatorsDelegators(operator).delegator;
            IDepositManagerTypes.OperatorDelegation memory delegation = getters.operatorsDelegators(
                operator
            );

            // Get the target TVL for the Delegator by the delegation portion.
            uint256 targetTVL = (delegation.delegationPortion * restakedTvl) /
                ConstantsCoreV2.PERCENTAGE_FACTOR;

            // If the operator Delegator TVL is less than the target TVL, return the Delegator's address.
            if (operatorDelegatorTVLs[i] < targetTVL) {
                return delegatorAddr;
            }
        }

        // If no operator Delegator TVL is less than the target TVL, return the first Delegator's address.
        return getters.operatorsDelegators(operatorsArray[0]).delegator;
    }

    /**
     * @dev Chooses the best Delegator for the withdrawal based on the TVL distribution.
     * @param restakedTvl Total restaked TVL.
     * @param operatorDelegatorTVLs Array of operator Delegator TVLs.
     * @param depositManager `DepositManager`'s address.
     * @return delegator Chosen delegator's address.
     */
    function chooseDelegatorForWithdrawal(
        uint256 restakedTvl,
        uint256[] calldata operatorDelegatorTVLs,
        address depositManager
    ) external view returns (address delegator) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);
        address[] memory operatorsArray = getters.getOperatorsArray();
        uint256 length = operatorsArray.length;

        // Ensure the operator list is not empty.
        if (operatorsArray.length == 0) revert EOperatorNotExists();

        // If there is only one operator, return the Delegator's address.
        if (length == 1) {
            return getters.operatorsDelegators(operatorsArray[0]).delegator;
        }

        uint256 tvlLength = operatorDelegatorTVLs.length;
        for (uint256 i = 0; i < tvlLength; ++i) {
            // Get the operator and Delegator addresses.
            address operator = operatorsArray[i];
            address delegatorAddr = getters.operatorsDelegators(operator).delegator;
            IDepositManagerTypes.OperatorDelegation memory delegation = getters.operatorsDelegators(
                operator
            );

            // Get the target TVL for the Delegator by the delegation portion.
            uint256 targetTVL = (delegation.delegationPortion * restakedTvl) /
                ConstantsCoreV2.PERCENTAGE_FACTOR;

            // If the operator Delegator TVL is greater than or equal to the target TVL, return the Delegator's address.
            if (operatorDelegatorTVLs[i] >= targetTVL) {
                return delegatorAddr;
            }
        }

        // If no operator Delegator TVL is greater than or equal to the target TVL, return the first Delegator's address.
        return getters.operatorsDelegators(operatorsArray[0]).delegator;
    }

    /**
     * @dev Gets the strategy for a specific token.
     * @param token Token's address.
     * @param depositManager `DepositManager`'s address.
     * @return strategy Strategy contract's address.
     */
    function getStrategy(address token, address depositManager) external view returns (address) {
        IDepositManagerGetters getters = IDepositManagerGetters(depositManager);

        // Get a strategy from the strategies mapping using the getter.
        IStrategy strategy = getters.strategies(token).strategy;

        if (address(strategy) == address(0)) {
            // Get from the strategy factory.
            IStrategyFactory strategyFactory = getters.STRATEGY_FACTORY();
            strategy = strategyFactory.deployedStrategies(IERC20(token));
        }
        return address(strategy);
    }
}
