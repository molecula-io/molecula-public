// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

/// @title Interface for the Wrapped Rebase Token.
/// @notice This interface provides the functionality for wrapping and unwrapping rebase tokens.
/// @dev Implements the core functionality for wrapping rebase tokens and distributing yield.
interface IWrappedRebaseAsset {
    // ============ Events ============

    /// @dev Event emitted when the user wrapped their rebase assets.
    /// @param sender User's address.
    /// @param rebaseAssets Rebase assets that the user wrapped and one got the same wrapped rebase assets.
    event Wrapped(address indexed sender, uint256 indexed rebaseAssets);

    /// @dev Event emitted when the user has unwrapped their wrapped rebase assets.
    /// @param sender User's address.
    /// @param wrappedRebaseAssets Wrapped rebase assets to burn.
    /// @param rebaseAssets Rebase assets received by the user.
    event Unwrapped(
        address indexed sender,
        uint256 indexed wrappedRebaseAssets,
        uint256 indexed rebaseAssets
    );

    /// @dev Event emitted when the yield is distributed for beneficiary.
    /// @param beneficiary User's address.
    /// @param shares Shares for the beneficiary.
    /// @param rebaseAssets Rebase assets.
    event YieldDistributed(
        address indexed beneficiary,
        uint256 indexed shares,
        uint256 indexed rebaseAssets
    );

    /// @dev Event emitted when an authorized Yield Distributor is changed.
    /// @param oldYieldDistributor Previous authorized Yield Distributor.
    /// @param newYieldDistributor New authorized Yield Distributor.
    event YieldDistributorChanged(
        address indexed oldYieldDistributor,
        address indexed newYieldDistributor
    );

    // ============ Errors ============

    /// @dev Throws an error if the Yield Distributor is not authorized.
    error ENotYieldDistributor();

    /// @dev Throws an error if shares for distributions are greater than the yield shares.
    error ETooManyShares();

    // ============ Core Functions ============

    /// @dev Convert rebase assets to wrapped rebase assets.
    /// @param rebaseAssets Rebase assets.
    function wrap(uint256 rebaseAssets) external;

    /// @dev Convert wrapped rebase assets to rebase assets.
    /// @param wrappedRebaseAssets Wrapped rebase assets.
    function unwrap(uint256 wrappedRebaseAssets) external;

    /// @dev Grant shares for the beneficiary.
    /// @param beneficiary Beneficiary address.
    /// @param shares Shares for the beneficiary.
    function distributeYield(address beneficiary, uint256 shares) external;

    /// @dev Setter for the Authorized Yield Distributor's address.
    /// @param newYieldDistributor New authorized Yield Distributor's address.
    function setYieldDistributor(address newYieldDistributor) external;

    // ============ View Functions ============

    /// @dev Returns rebase token's address.
    /// @return Rebase token's address.
    function rebaseToken() external view returns (address);

    /// @dev Returns authorized Yield Distributor.
    /// @return Authorized Yield Distributor.
    function yieldDistributor() external view returns (address);

    /// @dev Returns rebase token shares that the contract has.
    /// @return Rebase token shares that the contract has.
    function totalShares() external view returns (uint256);

    /// @dev Convert wrapped rebase assets to rebase assets.
    /// @param wrappedRebaseAssets Wrapped rebase assets.
    /// @return rebaseAssets Rebase assets.
    function convertToRebaseAssets(
        uint256 wrappedRebaseAssets
    ) external view returns (uint256 rebaseAssets);

    /// @dev Returns the current yield in the token value.
    /// @return Current yield in the token value.
    function currentYield() external view returns (uint256);

    /// @dev Returns the current yield in shares.
    /// @return Current yield in shares.
    function currentYieldShares() external view returns (uint256);
}
