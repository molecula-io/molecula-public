// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IwmUSD {
    // ============ Events ============

    /// @dev Event emitted when the user wrapped their mUSD tokens.
    /// @param sender User address.
    /// @param value mUSD amount that user wrapped and one got the same amount of wmUSD amount.
    event Wrapped(address indexed sender, uint256 indexed value);

    /// @dev Event emitted when the user has unwrapped their mUSD tokens.
    /// @param sender User address.
    /// @param wmUSDAmount wmUSD amount to burn.
    /// @param mUSDAmount mUSD amount that user gets.
    event Unwrapped(
        address indexed sender,
        uint256 indexed wmUSDAmount,
        uint256 indexed mUSDAmount
    );

    /// @dev Event emitted when yield is distributed for beneficiary.
    /// @param beneficiary User address.
    /// @param shares Shares for the beneficiary.
    /// @param mUSDAmount mUSD amount.
    event YieldDistributed(
        address indexed beneficiary,
        uint256 indexed shares,
        uint256 indexed mUSDAmount
    );

    /// @dev Event emitted when authorized yield distributor is changed.
    /// @param oldYieldDistributor Previous authorized yield distributor.
    /// @param newYieldDistributor New authorized yield distributor.
    event YieldDistributorChanged(
        address indexed oldYieldDistributor,
        address indexed newYieldDistributor
    );

    // ============ Errors ============

    /// @dev Throws an error if the Yield Distributor is not authorized.
    error ENotYieldDistributor();

    /// @dev Throws an error if shares for distributions are greater than the yield shares.
    error ETooManyShares();

    /// @dev Throws an error if the mUSD contract address is not set.
    error EContractIsEmpty();

    // ============ Core Functions ============

    /// @dev Convert mUSD to wmUSD.
    /// @param value Token amount.
    function wrap(uint256 value) external;

    /// @dev Convert wmUSD to mUSD.
    /// @param value Token amount.
    function unwrap(uint256 value) external;

    /// @dev Grant shares for the beneficiary.
    /// @param beneficiary Beneficiary address.
    /// @param shares Shares for the beneficiary.
    function distributeYield(address beneficiary, uint256 shares) external;

    /// @dev Setter for the Authorized Yield Distributor address.
    /// @param newYieldDistributor New authorized Yield Distributor address.
    function setYieldDistributor(address newYieldDistributor) external;

    // ============ View Functions ============

    /// @dev Returns mUSD Rebase token's address.
    /// @return mUSD Rebase token's address.
    function mUSD() external view returns (address);

    /// @dev Authorized yield distributor (e.g. the lmUSD token).
    /// @return Authorized yield distributor.
    function yieldDistributor() external view returns (address);

    /// @dev Returns mUSD wrapped shares.
    /// @return mUSD wrapped shares.
    function totalShares() external view returns (uint256);

    /// @dev Convert wmUSD to mUSD.
    /// @param wmUSDAmount wmUSD amount.
    /// @return mUSDAmount mUSD amount.
    function convertTomUSD(uint256 wmUSDAmount) external view returns (uint256 mUSDAmount);

    /// @dev Returns the current yield in the token value.
    /// @return Current yield in the token value.
    function currentYield() external view returns (uint256);

    /// @dev Returns the current yield in shares.
    /// @return Current yield in shares.
    function currentYieldShares() external view returns (uint256);
}
