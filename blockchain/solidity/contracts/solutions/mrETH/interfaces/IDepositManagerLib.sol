// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDepositManagerTypes} from "./IDepositManagerTypes.sol";

/**
 * @title IDepositManagerLib.
 * @dev Interface for DepositManager library functions
 */
interface IDepositManagerLib {
    /**
     * @dev Calculates available amounts to deposit for each Pool.
     * @param depositManager `DepositManager`'s address.
     * @return availableAmounts Array of available amounts for each Pool.
     * @return totalAvailableAmount Total available amount across all Pools.
     */
    function getAvailableAmountToDeposit(
        address depositManager
    ) external view returns (uint256[] memory availableAmounts, uint256 totalAvailableAmount);

    /**
     * @dev Calculates total buffered supply across all Pools.
     * @param depositManager `DepositManager`'s address.
     * @return totalBuffered Total buffered supply.
     * @return bufferedTvls Array of buffered TVL for each Pool.
     */
    function getTotalBufferedSupply(
        address depositManager
    ) external view returns (uint256 totalBuffered, uint256[] memory bufferedTvls);

    /**
     * @dev Calculates total restaked supply across all operators.
     * @param depositManager `DepositManager`'s address.
     * @return restakedTvl Total restaked TVL.
     * @return operatorDelegatorTVLs Array of Operator Delegator TVLs.
     */
    function getTotalRestakedSupply(
        address depositManager
    ) external view returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs);

    /**
     * @dev Calculates deposit amounts for Pools based on portions.
     * @param value Total amount to deposit.
     * @param availableAmounts Array of available amounts for each Pool.
     * @param depositManager `DepositManager`'s address.
     * @return depositAmounts Array of deposit amounts for each Pool.
     * @return remainingValue Remaining value after deposits.
     */
    function calculateDepositAmounts(
        uint256 value,
        uint256[] calldata availableAmounts,
        address depositManager
    ) external view returns (uint256[] memory depositAmounts, uint256 remainingValue);

    /**
     * @dev Calculates withdrawal amounts for Pools based on portions.
     * @param value Total amount to withdraw.
     * @param bufferedTvl Total buffered TVL.
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
    ) external view returns (uint256[] memory withdrawalAmounts, uint256 remainingValue);

    /**
     * @dev Calculates expected and actual Pool balances for rebalancing.
     * @param newPoolsData Array of new Pool configurations.
     * @param bufferTvl Buffer TVL for calculations.
     * @param depositManager `DepositManager`'s address.
     * @return expectedPoolsBalances Array of expected Pool balances.
     * @return actualPoolsBalances Array of actual Pool balances.
     */
    function calculateRebalanceBalances(
        IDepositManagerTypes.PoolData[] calldata newPoolsData,
        uint256 bufferTvl,
        address depositManager
    )
        external
        view
        returns (uint256[] memory expectedPoolsBalances, uint256[] memory actualPoolsBalances);

    /**
     * @dev Chooses a delegator for deposit based on the TVL distribution.
     * @param restakedTvl Total restaked TVL.
     * @param operatorDelegatorTVLs Array of Operator Delegator TVLs.
     * @param depositManager `DepositManager`'s address.
     * @return delegator Chosen Delegator's address.
     */
    function chooseDelegatorForDeposit(
        uint256 restakedTvl,
        uint256[] calldata operatorDelegatorTVLs,
        address depositManager
    ) external view returns (address delegator);

    /**
     * @dev Chooses a Delegator for withdrawal based on the TVL distribution.
     * @param restakedTvl Total restaked TVL.
     * @param operatorDelegatorTVLs Array of operator delegator TVLs.
     * @param depositManager `DepositManager`'s address.
     * @return delegator Chosen Delegator's address.
     */
    function chooseDelegatorForWithdrawal(
        uint256 restakedTvl,
        uint256[] calldata operatorDelegatorTVLs,
        address depositManager
    ) external view returns (address delegator);

    /**
     * @dev Gets the strategy for a specific token.
     * @param token Token's address.
     * @param depositManager `DepositManager`'s address.
     * @return strategy Strategy contract's address.
     */
    function getStrategy(
        address token,
        address depositManager
    ) external view returns (address strategy);

    /**
     * @dev Calculates the total supply (buffered + restaked).
     * @param depositManager `DepositManager`'s address.
     * @return totalSupply Total supply.
     */
    function totalSupply(address depositManager) external view returns (uint256);
}
