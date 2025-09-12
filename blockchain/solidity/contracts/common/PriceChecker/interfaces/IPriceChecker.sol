// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title IPriceChecker.
/// @notice Interface for checking asset prices against expected values and managing price feed configurations.
/// @dev Provides the functionality to set up price feeds, configure deviation thresholds, and validate asset prices.
interface IPriceChecker {
    // ============ Structs ============

    /// @dev Configuration struct for price checkers.
    /// @param asset Address of the asset being checked.
    /// @param priceFeed Address of the price feed contract.
    /// @param priceDeviationBps Maximum allowed price deviation in basis points (`1/10_000`).
    /// @param stalenessThreshold Staleness threshold in seconds.
    struct Checkers {
        address asset;
        address priceFeed;
        uint16 priceDeviationBps;
        uint32 stalenessThreshold;
    }

    /// @dev Information about the price checker configuration for a specific asset.
    /// @param priceFeed Address of the price feed contract used for price checks.
    /// @param priceDeviationBps Maximum allowed price deviation in basis points (`1/10_000`).
    /// @param stalenessThreshold Staleness threshold in seconds.
    /// @param isPresent Boolean flag indicating if the configuration is present.
    struct CheckerInfo {
        address priceFeed;
        uint16 priceDeviationBps;
        uint32 stalenessThreshold;
        bool isPresent;
    }

    // ============ Events ============

    /// @dev Emitted when the price feed is configured.
    /// @param asset Asset's address.
    /// @param feed Price feed's address.
    /// @param bps Price deviation value in basis points (e.g., 500 = 5%).
    /// @param stalenessThreshold Staleness threshold in seconds.
    event PriceFeedConfigured(
        address indexed asset,
        address indexed feed,
        uint16 indexed bps,
        uint32 stalenessThreshold
    );

    /// @dev Emitted when the price feed is removed.
    /// @param asset Asset's address.
    event PriceFeedRemoved(address indexed asset);

    /// @dev Emitted when the price deviation is changed.
    /// @param asset Asset's address.
    /// @param oldBps Previous allowed price deviation in basis points.
    /// @param bps New allowed price deviation in basis points.
    event PriceDeviationBpsChanged(
        address indexed asset,
        uint16 indexed oldBps,
        uint16 indexed bps
    );

    /// @dev Emitted when the price staleness threshold is changed.
    /// @param asset Asset's address.
    /// @param oldThreshold Previous staleness threshold.
    /// @param newThreshold New staleness threshold.
    event StalenessThresholdChanged(
        address indexed asset,
        uint32 indexed oldThreshold,
        uint32 indexed newThreshold
    );

    // ============ Errors ============

    /// @dev Error: Chainlink price feed data is stale — exceeded staleness threshold.
    /// @param feed Feed's address.
    error EChainlinkPriceFeedStale(address feed);

    /// @dev Error: Price not set.
    /// @param feed Feed's address.
    error EPriceNotSet(address feed);

    /// @dev Error: Too low or high staleness threshold.
    error EBadStalenessThreshold();

    /// @dev Error: Checker is already present.
    error ECheckerAlreadyPresent();

    /// @dev Error: Set the same value.
    error ESameValue();

    /// @dev Error for a price check failure.
    /// @param asset Asset's address.
    /// @param assetPrice Asset's price.
    /// @param expectedPrice Asset's expected price.
    /// @param deviationBps Allowed deviation in basis points.
    error EAssetPriceNotCloseToExpected(
        address asset,
        uint256 assetPrice,
        uint256 expectedPrice,
        uint256 deviationBps
    );

    /// @dev Error: No price checker configuration exists for the asset.
    /// @param asset Address of the asset without the price checker configuration.
    error NoPriceChecker(address asset);

    /// @dev Error: Bad feed configuration.
    error EBadFeedConfig();

    // ============ Core Functions ============

    /// @dev Set both the price feed and allowed deviation in one call (`onlyOwner`).
    /// @param asset Asset's address.
    /// @param feed Price feed's address.
    /// @param bps Allowed price deviation in basis points.
    /// @param stalenessThreshold Staleness threshold in seconds.
    function setPriceFeed(
        address asset,
        address feed,
        uint16 bps,
        uint32 stalenessThreshold
    ) external;

    /// @dev Change the allowed price deviation in basis points (`onlyOwner`).
    /// @param asset Asset's address.
    /// @param bps Allowed price deviation in basis points.
    function changePriceDeviationBps(address asset, uint16 bps) external;

    /// @dev Change the staleness threshold in seconds (`onlyOwner`).
    /// @param asset Asset's address.
    /// @param stalenessThreshold Staleness threshold in seconds.
    function changeStalenessThreshold(address asset, uint32 stalenessThreshold) external;

    /// @dev Remove the price feed configuration (`onlyOwner`).
    /// @param asset Asset's address.
    function removePriceFeed(address asset) external;

    // ============ View Functions ============

    /// @dev Check if the current asset price is within allowed deviation from the expected price.
    /// @param tokenVault Address of the token Vault associated with the asset whose price needs to be checked.
    function checkPrice(address tokenVault) external view;

    /// @dev Verifies that a price checker configuration exists for the specified asset.
    /// @param asset Address of the asset to verify.
    /// @notice Reverts with the `NoPriceChecker` error if no configuration exists for the asset.
    function ensureHasPriceFeed(address asset) external view;
}
