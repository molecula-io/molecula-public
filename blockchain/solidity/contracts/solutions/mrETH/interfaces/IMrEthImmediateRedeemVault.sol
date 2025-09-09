// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

import {ITokenVaultWithImmediateRedeem} from "./../../../coreV2/TokenVault/interfaces/ITokenVaultWithImmediateRedeem.sol";

/// @title IMrEthImmediateRedeemVault.
/// @dev Interface to extend the `ITokenVaultWithImmediateRedeem` interface for previewing immediate redeemable assets.
interface IMrEthImmediateRedeemVault is ITokenVaultWithImmediateRedeem {
    /// @dev Emitted when an immediate redemption request is made.
    /// @param controller Controller's address.
    /// @param owner Owner's address.
    /// @param requestId Request's ID.
    /// @param sender Sender's address.
    /// @param assets Amount of assets to redeem.
    event ImmediateRedeem(
        address indexed controller,
        address indexed owner,
        uint256 indexed requestId,
        address sender,
        uint256 assets
    );

    /// @dev Emitted when the Yield Distributor address is changed.
    /// @param oldYieldDistributor Previous Yield Distributor's address.
    /// @param newYieldDistributor New Yield Distributor's address.
    event YieldDistributorChanged(
        address indexed oldYieldDistributor,
        address indexed newYieldDistributor
    );

    /// @dev Emitted when the yield is distributed.
    /// @param beneficiary Beneficiary's address.
    /// @param shares Amount of shares distributed.
    event YieldDistributed(address indexed beneficiary, uint256 indexed shares);

    /// @dev Error: Immediate redeem is not allowed.
    error EImmediateRedeemNotAllowed();

    /// @dev Error: Balance before is less than the redeem value.
    error EBalanceBeforeLessThanValue();

    /// @dev Error: Too many shares.
    error ETooManyShares();

    /**
     * @dev Implements the immediate withdrawable assets.
     * @param shares Amount of shares to redeem.
     * @return withdrawableAssets Available amount of assets to redeem immediately.
     */
    function previewImmediateRedeem(
        uint256 shares
    ) external view returns (uint256 withdrawableAssets);

    /**
     * @dev Distributes yield.
     * @param beneficiary Beneficiary's address.
     * @param shares Amount of shares to distribute.
     */
    function distributeYield(address beneficiary, uint256 shares) external;

    /**
     * @dev Setter for the Yield Distributor address.
     * @param newYieldDistributor New Yield Distributor address.
     */
    function setYieldDistributor(address newYieldDistributor) external;
}
