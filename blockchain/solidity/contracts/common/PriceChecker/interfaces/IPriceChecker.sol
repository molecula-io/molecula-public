// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice IPriceChecker
interface IPriceChecker {
    // ============ Events ============

    /// @dev Emitted when the price feed is configured.
    /// @param feed Price feed's address.
    /// @param is4626 `True` if it is an EIP-4626 asset feed.
    event PriceFeedConfigured(address indexed feed, bool indexed is4626);

    /// @dev Emitted when the price feed is removed.
    event PriceFeedRemoved();

    /// @dev Emitted when the price deviation is set.
    /// @param oldBps Previous allowed price deviation in basis points.
    /// @param bps New allowed price deviation in basis points.
    event PriceDeviationBpsSet(uint16 indexed oldBps, uint16 indexed bps);

    // ============ Errors ============

    /// @dev Error: Price not set.
    error EPriceNotSet();

    /// @dev Error: Not an EIP-4626 asset.
    error ENotEIP4626Asset();

    /// @dev Error: Too large deviation.
    error ETooHighDeviation();

    /// @dev Error: Set the same value.
    error ESameValue();

    /// @dev Error for a price check failure.
    /// @param assetPrice Asset's price.
    /// @param expectedPrice Asset's expected price.
    /// @param deviationBps Allowed deviation in basis points.
    error EAssetPriceNotCloseToExpected(
        uint256 assetPrice,
        uint256 expectedPrice,
        uint256 deviationBps
    );

    // ============ Core Functions ============

    /// @dev Set the allowed price deviation in basis points (`onlyOwner`).
    /// @param bps Allowed price deviation in basis points.
    function setPriceDeviationBps(uint16 bps) external;

    /// @dev Set the price feed address and type (`onlyOwner`).
    /// @param feed Price feed's address.
    /// @param is4626 `True` if it is an EIP-4626 asset feed.
    function setPriceFeed(address feed, bool is4626) external;

    /// @dev Set both the price feed and allowed deviation in one call (`onlyOwner`).
    /// @param feed Price feed's address.
    /// @param is4626 `True` if it is an EIP-4626 asset feed.
    /// @param bps Allowed price deviation in basis points.
    function setPriceFeedAndBps(address feed, bool is4626, uint16 bps) external;

    /// @dev Remove the price feed configuration (`onlyOwner`).
    function removePriceFeed() external;

    // ============ View Functions ============

    /// @dev Returns an address of the asset to check the price for.
    /// @return Address of the asset to check the price for.
    function asset() external returns (address);

    /// @dev Returns an address of the Chainlink price feed contract.
    /// @return Address of the Chainlink price feed contract.
    function priceFeed() external returns (address);

    /// @dev Returns a boolean flag indicating if the price feed is for an EIP-4626 asset.
    /// @return Flag indicating if the price feed is for an EIP-4626 asset.
    function isPriceFeedEIP4626() external returns (bool);

    /// @dev Returns the maximum allowed price deviation in basis points (e.g., 500 = 5%).
    /// @return Maximum allowed price deviation in basis points (e.g., 500 = 5%).
    function priceDeviationBps() external returns (uint16);

    /// @dev Check if the current asset price is within allowed deviation from expected price.
    /// @notice Reverts with `ETooHighDeviation` if the price deviation is larger than the allowed one.
    function checkPrice() external view;
}
