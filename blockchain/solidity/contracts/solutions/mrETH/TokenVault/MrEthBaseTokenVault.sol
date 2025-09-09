// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ConstantsCoreV2} from "./../../../coreV2/Constants.sol";
import {IOracleV2} from "./../../../coreV2/interfaces/IOracleV2.sol";
import {ISupplyManagerV2} from "./../../../coreV2/interfaces/ISupplyManagerV2.sol";
import {BaseTokenVault, IIssuer} from "./../../../coreV2/TokenVault/BaseTokenVault.sol";
import {IDepositManagerGetters} from "./../interfaces/IDepositManagerGetters.sol";
import {IDepositManagerWithImmediateRedeem} from "./../interfaces/IDepositManagerPool.sol";
import {IDepositManagerTypes} from "./../interfaces/IDepositManagerTypes.sol";
import {ITokenVaultWithImmediateRedeem, IMrEthImmediateRedeemVault} from "./../interfaces/IMrEthImmediateRedeemVault.sol";
import {OperationsType} from "./OperationTypes.sol";

/// @title MrEthBaseTokenVault.
/// @notice Base Vault contract for managing deposits and withdrawals in the mrETH system.
/// @dev Extends `BaseTokenVault` to implement the mrETH-specific functionality for token redemption.
abstract contract MrEthBaseTokenVault is
    BaseTokenVault,
    OperationsType,
    IMrEthImmediateRedeemVault
{
    using SafeERC20 for IERC20;

    /// @dev Address of the Yield Distributor address.
    address public yieldDistributor;

    /// @dev Initializes `MrEthBaseTokenVault` with required dependencies.
    /// @param yieldDistributor_ Address of the immediate redemption Yield Distributor.
    constructor(address yieldDistributor_) notZeroAddress(yieldDistributor_) {
        yieldDistributor = yieldDistributor_;
    }

    /// @inheritdoc ITokenVaultWithImmediateRedeem
    function redeemImmediately(
        uint256 shares,
        address controller,
        address owner
    ) external virtual onlyOperator(owner) returns (uint256 requestId) {
        return _redeemImmediately(shares, controller, owner);
    }

    /// @dev Processes a redemption request.
    /// @param shares Amount of shares to redeem.
    /// @param controller Address that will receive assets.
    /// @param owner Address that owns the shares.
    /// @return requestId Redemption's ID.
    /// Note: `notZeroAddress(owner)` is not called as the owner has already been checked.
    function _redeemImmediately(
        uint256 shares,
        address controller,
        address owner
    )
        internal
        virtual
        checkNotPause(_REQUEST_REDEEM_SELECTOR)
        notZeroAddress(controller)
        returns (uint256 requestId)
    {
        // Check if the requested shares do not exceed the owner's balance.
        uint256 ownerMaxRedeem = maxRedeem(owner);
        if (shares > ownerMaxRedeem) {
            revert ETooManyRequestRedeemShares(shares, ownerMaxRedeem);
        }

        // Check the redemption operation value.
        if (shares < minRedeemShares) {
            revert ETooLowRequestRedeemShares(shares, minRedeemShares);
        }

        // Generate an ID for each new operation.
        // Note: According to ERC-7540, returning `requestId` must be equal to zero, as we aggregate requests.
        // However, here we have `requestId != 0`.
        requestId = _generateId();

        // Set the operation type.
        _setOperationType(requestId, OperationType.RedeemFromBuffer);

        // Calculate the withdrawable assets.
        uint256 withdrawableAssets = previewImmediateRedeem(shares);

        // Convert withdrawable assets into shares to determine the exact amount to request for redemption.
        uint256 withdrawableShares = convertToShares(withdrawableAssets);

        // Burn the owner's shares.
        // slither-disable-next-line reentrancy-benign
        IIssuer(_issuer()).burn(owner, shares);

        // Mint the fee shares to the Vault.
        // slither-disable-next-line reentrancy-benign
        IIssuer(_issuer()).mint(address(this), shares - withdrawableShares);

        // Call the Supply Manager's `requestRedeem` method.
        // slither-disable-next-line reentrancy-benign
        uint256 assets = _supplyManagerRequestRedeem(
            controller,
            owner,
            requestId,
            withdrawableShares
        );

        // Increase the amount of pending redeem shares for the controller.
        _redeemInfo[controller].pendingRedeemShares += withdrawableShares;

        // Redeem the assets from the Molecula Pool.
        _redeemImmediatelyFromPool(requestId);

        // Emit an event to log the immediate redemption operation request.
        emit ImmediateRedeem(controller, owner, requestId, msg.sender, assets);
    }

    /// @inheritdoc IMrEthImmediateRedeemVault
    function previewImmediateRedeem(
        uint256 shares
    ) public view virtual returns (uint256 withdrawableAssets) {
        // Convert the shares into Molecula assets.
        uint256 moleculaAssets = IOracleV2(_SHARE).convertToAssets(shares);

        // Calculate the withdrawable assets.
        withdrawableAssets = _calculateWithdrawableAssets(moleculaAssets);
    }

    /// @inheritdoc IMrEthImmediateRedeemVault
    function distributeYield(
        address beneficiary,
        uint256 shares
    ) public virtual only(yieldDistributor) {
        // Check whether there are enough shares.
        if (shares > IERC20(_SHARE).balanceOf(address(this))) {
            revert ETooManyShares();
        }

        // Transfer the requested amount of `shares` to the beneficiary.
        IERC20(_SHARE).safeTransfer(beneficiary, shares);

        // Emit an event for tracking.
        emit YieldDistributed(beneficiary, shares);
    }

    /**
     * @dev Calculates the fee amount based on the formula:
     * `withdrawableAssets = moleculaTokenAssets - feeAmount`
     * `feeAmount = minFeePercentage +
     * ((maxFeePercentage - minFeePercentage) / (bufferedTvl - balanceMin)) * (bufferedTvl - balanceAfter)`
     * @param moleculaTokenAssets Molecula assets' value to withdraw.
     * @return withdrawableAssets Value to withdraw.
     */
    function _calculateWithdrawableAssets(
        uint256 moleculaTokenAssets
    ) internal view returns (uint256 withdrawableAssets) {
        // Get the Molecula Pool's address.
        address moleculaPool = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();

        // Get the total buffered supply that is the Buffer's balance before the withdrawal.
        // slither-disable-next-line unused-return
        (uint256 bufferedTvl, ) = IDepositManagerGetters(moleculaPool).totalBufferedSupply();

        // Get the Pool's total supply.
        uint256 totalSupply = IDepositManagerGetters(moleculaPool).totalSupply();

        IDepositManagerTypes.Config memory config = IDepositManagerGetters(moleculaPool).config();

        // Check if `balanceBefore` is greater than the withdrawal of `moleculaTokenAssets`.
        if (bufferedTvl < moleculaTokenAssets) {
            revert EBalanceBeforeLessThanValue();
        }

        // If the buffer percentage is zero, the immediate redemption is not allowed.
        if (config.bufferPercentage == 0) {
            revert EImmediateRedeemNotAllowed();
        }

        // Calculate the minimum balance to maintain the Buffer percentage.
        uint256 balanceMin = (totalSupply * config.bufferPercentage) /
            ConstantsCoreV2.PERCENTAGE_FACTOR;

        unchecked {
            // Calculate the minimum and maximum fees.
            uint256 minFee = config.minFeePercentage * moleculaTokenAssets;

            // Calculate the fee range: `(maxFee_bps - minFee_bps) / PERCENTAGE_FACTOR`.
            // slither-disable-next-line divide-before-multiply
            uint256 feeRange = (config.maxFeePercentage - config.minFeePercentage) *
                moleculaTokenAssets;

            // Calculate the scaled fee: `feeRange * (bufferedTvl - balanceAfter) / (bufferedTvl - balanceMin)`.
            // `balanceAfter = bufferedTvl - moleculaTokenAssets`, so we can simplify the formula to:
            // `feeRange * moleculaTokenAssets / (bufferedTvl - balanceMin)`
            uint256 scaledFee = (feeRange * moleculaTokenAssets) / (bufferedTvl - balanceMin);

            uint256 feeAmount = (minFee + scaledFee) / ConstantsCoreV2.PERCENTAGE_FACTOR;

            withdrawableAssets = moleculaTokenAssets - feeAmount;
        }
    }

    /// @inheritdoc IMrEthImmediateRedeemVault
    function setYieldDistributor(
        address newYieldDistributor
    ) external virtual onlyOwner notZeroAddress(newYieldDistributor) {
        address oldYieldDistributor = yieldDistributor;
        yieldDistributor = newYieldDistributor;
        emit YieldDistributorChanged(oldYieldDistributor, newYieldDistributor);
    }

    /// @dev Redeems the assets from the Molecula Pool.
    /// @param requestId Redemption operation's ID.
    function _redeemImmediatelyFromPool(uint256 requestId) internal virtual {
        // Get the Molecula Pool's address.
        address moleculaPool = ISupplyManagerV2(SUPPLY_MANAGER).getMoleculaPool();

        // Create a request ID array.
        uint256[] memory requestIds = new uint256[](1);
        requestIds[0] = requestId;

        // Redeem the assets from the Molecula Pool.
        IDepositManagerWithImmediateRedeem(moleculaPool).fulfillRedeemImmediately(requestIds);
    }
}
