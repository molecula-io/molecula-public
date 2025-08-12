// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAaveV3Pool as IPool} from "./../external/interfaces/IAaveV3Pool.sol";
import {IScaledBalanceToken} from "./../external/interfaces/IScaledBalanceToken.sol";
import {DataTypes} from "./../external/libraries/DataTypes.sol";
import {MathUtils} from "./../external/libraries/MathUtils.sol";
import {PercentageMath} from "./../external/libraries/PercentageMath.sol";
import {WadRayMath} from "./../external/libraries/WadRayMath.sol";

/// @title AAVE Buffer Library
/// @notice Library for interacting with AAVE lending Pools.
library AaveBufferLib {
    using WadRayMath for uint256;
    using PercentageMath for uint256;

    /// @dev Constant for the selector of the the AAVE's `deposit` function.
    bytes4 internal constant SUPPLY_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("supply(address,uint256,address,uint16)"));

    /// @dev Constant for the selector of the AAVE's `withdraw` function.
    bytes4 internal constant WITHDRAW_SELECTOR =
        // solhint-disable-next-line gas-small-strings
        bytes4(keccak256("withdraw(address,uint256,address)"));

    /// @dev Constant for the mask of the supply cap in the AAVE v3 storage.
    uint256 internal constant SUPPLY_CAP_MASK =
        0x00000000000000000000000000FFFFFFFFF00000000000000000000000000000;

    /// @dev Constant for the mask of the reserve factor in the AAVE v3 storage.
    uint256 internal constant RESERVE_FACTOR_MASK =
        0x00000000000000000000000000000000000000000000FFFF0000000000000000;

    /// @dev Constant for the start bit position of the reserve factor in the AAVE v3 storage.
    uint256 internal constant RESERVE_FACTOR_START_BIT_POSITION = 64;

    /// @dev Constant for the start bit position of the supply cap in the AAVE v3 storage.
    uint256 internal constant SUPPLY_CAP_START_BIT_POSITION = 116;

    /// @dev Constant for the precision offset for the supply cap.
    uint256 internal constant PRECISION_OFFSET = 2e15;

    /**
     * @dev Encodes the data for depositing into the AAVE Pool.
     * @param token Deposit token's address.
     * @param receiver LP token receiver's address.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(SUPPLY_SELECTOR, token, amount, receiver, 0);
    }

    /**
     * @dev Encodes data for withdrawing from an AAVE Pool.
     * @param token Deposit token's address.
     * @param receiver Address of the LP token receiver.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(WITHDRAW_SELECTOR, token, amount, receiver);
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
     * @notice Calculates the maximum amount that can be supplied without hitting the cap,
     *         accounting for projected interest accruals and treasury shares for precision.
     * @dev This matches AAVE's internal validation logic in `ValidationLogic.validateSupply()`
     *      by simulating pending state updates (indexes and treasury accrual) without modifying the on-chain state.
     * @param pool Address of the protocol's balance storage.
     * @param token Deposit token's address.
     * @return available Maximum deposit amount in atomic units (e.g., wei for wETH).
     *                   Returns `type(uint256).max` if unlimited. Returns `0` if the cap is reached.
     */
    function getAvailableAmountToDeposit(
        address pool,
        address token,
        address
    ) external view returns (uint256) {
        IPool _pool = IPool(pool);

        // Extract the supply cap using the library with the correct bit masking handled internally.
        uint256 supplyCap = getCap(_pool, token);

        if (supplyCap == 0) {
            return type(uint256).max; // Unlimited supply allowed.
        }

        // Current supply projection.
        uint256 currentSupply;

        try _pool.getReserveData(token) returns (DataTypes.ReserveDataLegacy memory reserve) {
            // Simulate a state update for precise projection of indexes. Replicates `ReserveLogic._updateIndexes` in view mode.
            (uint256 nextLiquidityIndex, uint256 nextVariableBorrowIndex) = simulateIndexUpdates(
                reserve
            );

            // Simulate a treasury accrual. Replicates `ReserveLogic._accrueToTreasury` in view mode.
            uint256 scaledVariableDebt = IScaledBalanceToken(reserve.variableDebtTokenAddress)
                .scaledTotalSupply();
            uint256 currTotalVariableDebt = scaledVariableDebt.rayMul(nextVariableBorrowIndex);
            uint256 accrualToTreasuryScaled = simulateTreasuryAccrual(
                reserve,
                currTotalVariableDebt,
                scaledVariableDebt,
                nextLiquidityIndex
            );

            // Total scaled supply including projected treasury
            uint256 totalScaled = IScaledBalanceToken(reserve.aTokenAddress).scaledTotalSupply() +
                accrualToTreasuryScaled;

            // Current supply projection (matches what validateSupply would check)
            currentSupply = totalScaled.rayMul(nextLiquidityIndex) + PRECISION_OFFSET;
        } catch {
            currentSupply = IERC20(token).totalSupply();
        }

        // Max supply in atomic units
        uint256 maxSupply = supplyCap * 10 ** IERC20Metadata(token).decimals();

        // Return the available amount, clamped to 0.
        unchecked {
            return maxSupply > currentSupply ? maxSupply - currentSupply : 0;
        }
    }

    /**
     * @dev Simulates index updates without state change. Based on `ReserveLogic._updateIndexes`.
     *      Handles cases where no time has passed, useing current indexes.
     * @param reserve Reserve data.
     * @return nextLiquidityIndex Next liquidity index.
     * @return nextVariableBorrowIndex Next variable borrow index.
     */
    function simulateIndexUpdates(
        DataTypes.ReserveDataLegacy memory reserve
    ) internal view returns (uint256 nextLiquidityIndex, uint256 nextVariableBorrowIndex) {
        uint40 lastUpdateTimestamp = reserve.lastUpdateTimestamp;
        if (lastUpdateTimestamp == uint40(block.timestamp)) {
            return (reserve.liquidityIndex, reserve.variableBorrowIndex);
        }

        uint256 cumulatedLiquidity = MathUtils.calculateLinearInterest(
            reserve.currentLiquidityRate,
            lastUpdateTimestamp
        );
        nextLiquidityIndex = cumulatedLiquidity.rayMul(reserve.liquidityIndex);

        uint256 cumulatedVariable = MathUtils.calculateCompoundedInterest(
            reserve.currentVariableBorrowRate,
            lastUpdateTimestamp
        );
        nextVariableBorrowIndex = cumulatedVariable.rayMul(reserve.variableBorrowIndex);

        return (nextLiquidityIndex, nextVariableBorrowIndex);
    }

    /**
     * @dev Simulates treasury accrual without a state change. Based on `ReserveLogic._accrueToTreasury`.
     *      Only accrues if `reserveFactor > 0` and time has passed.
     * @param reserve Reserve data.
     * @param currTotalVariableDebt Current total variable debt.
     * @param scaledVariableDebt Scaled variable debt.
     * @param nextLiquidityIndex Next liquidity index.
     * @return newAccruedToTreasury Accrued to treasury.
     */
    function simulateTreasuryAccrual(
        DataTypes.ReserveDataLegacy memory reserve,
        uint256 currTotalVariableDebt,
        uint256 scaledVariableDebt,
        uint256 nextLiquidityIndex
    ) internal view returns (uint256 newAccruedToTreasury) {
        uint256 reserveFactor = getReserveFactor(reserve.configuration.data);
        if (reserveFactor == 0 || reserve.lastUpdateTimestamp >= block.timestamp) {
            return reserve.accruedToTreasury;
        }

        // Calculate previous total variable debt at the last interaction.
        uint256 prevTotalVariableDebt = scaledVariableDebt.rayMul(reserve.variableBorrowIndex);

        // Debt accrued is the difference between current and previous debt.
        uint256 totalDebtAccrued;
        unchecked {
            totalDebtAccrued = currTotalVariableDebt > prevTotalVariableDebt
                ? currTotalVariableDebt - prevTotalVariableDebt
                : 0;
        }

        // Calculate the amount to mint to treasury based on reserve factor.
        uint256 amountToMint = totalDebtAccrued.percentMul(reserveFactor);

        // If there is no amount to mint, return the current `accruedToTreasury` value.
        if (amountToMint == 0) {
            return reserve.accruedToTreasury;
        }

        // Convert to scaled units for the treasury. Div by `nextLiquidityIndex`.
        uint256 accrualDelta = amountToMint.rayDiv(nextLiquidityIndex);

        // Add accrual delta to current accruedToTreasury
        newAccruedToTreasury = reserve.accruedToTreasury + accrualDelta;
    }

    /**
     * @dev Gets the supply cap of the reserve from the storage.
     * @param pool The AAVE v3 Pool's address.
     * @param token Token's address.
     * @return State param representing the supply cap, `accruedToTreasury`, and `liquidityIndex`.
     */
    function getCap(IPool pool, address token) internal view returns (uint256) {
        uint256 dataLocal = (pool.getConfiguration(token)).data;

        return (dataLocal & SUPPLY_CAP_MASK) >> SUPPLY_CAP_START_BIT_POSITION;
    }

    /**
     * @dev Gets the reserve factor from the reserve data.
     * @param data Reserve data.
     * @return Reserve factor.
     */
    function getReserveFactor(uint256 data) public pure returns (uint256) {
        return (data & RESERVE_FACTOR_MASK) >> RESERVE_FACTOR_START_BIT_POSITION;
    }
}
