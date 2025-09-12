// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {IERC7575} from "./../../coreV2/external/interfaces/IERC7575.sol";
import {IBaseTokenVault} from "./../../coreV2/TokenVault/interfaces/ITokenVault.sol";
import {_getDecimalsOr18, _normalize} from "./../Utils.sol";
import {ValueValidator} from "./../ValueValidator.sol";
import {AggregatorV3Interface} from "./externals/AggregatorV3Interface.sol";
import {IPriceChecker} from "./interfaces/IPriceChecker.sol";

/// @title PriceChecker.
/// @dev Check for pair kind of `(USDc, USDe, sUSDe) / USD`; `(stETH) / ETH`, etc.
contract PriceChecker is IPriceChecker, Ownable2Step, ValueValidator {
    // ============ State Variables ============

    /// @dev Minimal staleness threshold.
    uint32 internal constant _MIN_STALENESS_THRESHOLD = 15 seconds;

    /// @dev Maximal staleness threshold.
    uint32 internal constant _MAX_STALENESS_THRESHOLD = 7 days;

    /// @dev Molecula token decimals.
    uint8 public immutable MOLECULA_TOKEN_DECIMALS;

    /// @dev Maps asset addresses to their price checker configurations.
    mapping(address asset => CheckerInfo) public checkers;

    // ============ Modifiers ============

    /// @dev Check that staleness threshold is in an adequate range.
    /// @param stalenessThreshold Staleness threshold in seconds.
    modifier checkStalenessThreshold(uint32 stalenessThreshold) {
        if (
            stalenessThreshold < _MIN_STALENESS_THRESHOLD ||
            stalenessThreshold > _MAX_STALENESS_THRESHOLD
        ) {
            revert EBadStalenessThreshold();
        }
        _;
    }

    // ============ Constructor ============

    /// @notice Initializes the PriceChecker contract.
    /// @dev Sets up the initial configuration for the price checking functionality.
    /// @param checkers_ Array of initial price checker configurations to set up.
    /// @param initialOwner Address of the initial contract owner.
    /// @param moleculaTokenDecimals Molecula token decimals.
    constructor(
        Checkers[] memory checkers_,
        address initialOwner,
        uint8 moleculaTokenDecimals
    ) Ownable(initialOwner) notZero(moleculaTokenDecimals) {
        MOLECULA_TOKEN_DECIMALS = moleculaTokenDecimals;

        uint256 length = checkers_.length;
        for (uint256 i = 0; i < length; ++i) {
            Checkers memory checker = checkers_[i];
            if (checkers[checker.asset].isPresent) {
                revert ECheckerAlreadyPresent();
            }
            _setPriceFeed(
                checker.asset,
                checker.priceFeed,
                checker.priceDeviationBps,
                checker.stalenessThreshold
            );
        }
    }

    // ============ Owner's Functions ============

    /// @inheritdoc IPriceChecker
    function setPriceFeed(
        address asset,
        address feed,
        uint16 bps,
        uint32 stalenessThreshold
    ) public virtual override onlyOwner {
        // Check that the new price feed configuration is the same as the previous one.
        CheckerInfo storage checkerInfo = checkers[asset];
        if (
            checkerInfo.priceFeed == feed &&
            checkerInfo.priceDeviationBps == bps &&
            checkerInfo.stalenessThreshold == stalenessThreshold
        ) {
            revert ESameValue();
        }

        // Set the new price feed configuration.
        _setPriceFeed(asset, feed, bps, stalenessThreshold);

        // Emit an event to log the operation.
        emit PriceFeedConfigured(asset, feed, bps, stalenessThreshold);
    }

    /// @inheritdoc IPriceChecker
    function changePriceDeviationBps(
        address asset,
        uint16 bps
    ) external virtual override onlyOwner checkBPS(bps) {
        // Get the price checker configuration from the storage for the given asset.
        CheckerInfo storage checkerInfo = _getPriceCheckerOrThrow(asset);

        // Check that the new price deviation is the same as the previous one.
        uint16 oldBps = checkerInfo.priceDeviationBps;
        if (oldBps == bps) {
            revert ESameValue();
        }

        // Set the price deviation in basis points.
        checkerInfo.priceDeviationBps = bps;

        // Emit an event to log the operation.
        emit PriceDeviationBpsChanged(asset, oldBps, bps);
    }

    /// @inheritdoc IPriceChecker
    function changeStalenessThreshold(
        address asset,
        uint32 stalenessThreshold
    ) external virtual override onlyOwner checkStalenessThreshold(stalenessThreshold) {
        // Get the price checker configuration from the storage for the given asset.
        CheckerInfo storage checkerInfo = _getPriceCheckerOrThrow(asset);

        // Check that the new threshold is the same as the previous one.
        uint32 oldThreshold = checkerInfo.stalenessThreshold;
        if (oldThreshold == stalenessThreshold) {
            revert ESameValue();
        }

        // Set the price deviation in basis points.
        checkerInfo.stalenessThreshold = stalenessThreshold;

        // Emit an event to log the operation.
        emit StalenessThresholdChanged(asset, oldThreshold, stalenessThreshold);
    }

    /// @inheritdoc IPriceChecker
    function removePriceFeed(address asset) external virtual override onlyOwner {
        // Check that the asset is present. Otherwise, throw an exception.
        _getPriceCheckerOrThrow(asset);

        // Remove the checker for the asset.
        delete checkers[asset];

        // Emit an event to log the operation.
        emit PriceFeedRemoved(asset);
    }

    // ============ View Functions ============

    /// @dev Checks that the asset price is around 1 USD (1 ETH, 1 BTC, etc.), within the allowed deviation.
    ///      If a price feed is set for the token, then check that the token price is within the allowed deviation.
    ///      If the price feed is not set but the asset is present, do nothing.
    ///      Otherwise, throw an exception.
    /// @param tokenVault Address of the token Vault associated with the asset whose price needs to be checked.
    function checkPrice(address tokenVault) external view virtual override {
        // Get the asset associated with the token vault.
        address asset = IERC7575(tokenVault).asset();

        // Get the price checker configuration from the storage for the given asset.
        CheckerInfo storage checkerInfo = _getPriceCheckerOrThrow(asset);

        // No need to check the price for assets with no price feed as it's OK for native tokens (ETH)
        // or pegged tokens (wETH), and some other tokens to not have a price feed.
        if (checkerInfo.priceFeed == address(0)) {
            return;
        }

        // Convert one token unit into the amount of the Molecula asset (USD, ETH, etc.).
        // This should be an expected price of the asset which is yet to be normalized
        // to match the decimals of the price feed.
        uint256 oneUnit = uint256(10) ** _getDecimalsOr18(asset);
        uint256 expectedPrice = IBaseTokenVault(tokenVault).convertAssetsToMoleculaAssets(oneUnit);

        // Normalize the expected price to match the decimals of the price feed.
        uint8 feedDecimals = AggregatorV3Interface(checkerInfo.priceFeed).decimals();

        // Find the expected price of the asset in the units of the price feed.
        expectedPrice = _normalize(expectedPrice, MOLECULA_TOKEN_DECIMALS, feedDecimals);

        // Get the asset price.
        uint256 assetPrice = uint256(
            _getFeedPrice(checkerInfo.priceFeed, checkerInfo.stalenessThreshold)
        );

        uint256 absDiff = assetPrice > expectedPrice
            ? assetPrice - expectedPrice
            : expectedPrice - assetPrice;

        // Check that the price is approximately equal to the expected price, within the allowed deviation.
        // Formula of the relative error for the acceptable price:
        // `|assetPrice - expectedPrice| / expectedPrice < epsilon`
        // `|assetPrice - expectedPrice| / expectedPrice < priceDeviationBps / 10_000`
        // `|assetPrice - expectedPrice| * 10_000 < priceDeviationBps * expectedPrice`
        if (
            absDiff * ConstantsCoreV2.PERCENTAGE_FACTOR >
            checkerInfo.priceDeviationBps * expectedPrice
        ) {
            revert EAssetPriceNotCloseToExpected(
                asset,
                assetPrice,
                expectedPrice,
                checkerInfo.priceDeviationBps
            );
        }
    }

    /// @inheritdoc IPriceChecker
    function ensureHasPriceFeed(address asset) public view virtual override {
        _getPriceCheckerOrThrow(asset);
    }

    // ============ Internal Functions ============

    /// @dev Gets the price feed configuration if presented. Otherwise, throws an exception.
    /// @param asset Asset's address.
    /// @return checkerInfo Price feed configuration.
    function _getPriceCheckerOrThrow(
        address asset
    ) internal view virtual returns (CheckerInfo storage checkerInfo) {
        checkerInfo = checkers[asset];
        if (!checkerInfo.isPresent) {
            revert NoPriceChecker(asset);
        }
    }

    /// @dev Gets the latest price from a Chainlink price feed and validates it.
    /// @param feed Chainlink price feed contract's address.
    /// @param stalenessThreshold Staleness threshold in seconds.
    /// @return price Latest price from the feed. Reverts if the price is negative.
    function _getFeedPrice(
        address feed,
        uint32 stalenessThreshold
    ) internal view virtual returns (int256 price) {
        uint256 updatedAt;
        // slither-disable-next-line unused-return
        (, price, , updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();

        // Check that the price is present.
        if (price <= 0) {
            revert EPriceNotSet(feed);
        }

        // Check if the price feed data is stale based on the configured threshold.
        if (updatedAt + stalenessThreshold < block.timestamp) {
            revert EChainlinkPriceFeedStale(feed);
        }
    }

    /// @dev Set the price feed address, type, and allowed price deviation in basis points.
    /// @param asset Address of the asset to set price feed for.
    /// @param feed Price feed's address.
    /// @param bps New price deviation value in basis points (e.g., 500 = 5%).
    /// @param stalenessThreshold Staleness threshold in seconds.
    function _setPriceFeed(
        address asset,
        address feed,
        uint16 bps,
        uint32 stalenessThreshold
    ) internal virtual notZeroAddress(asset) {
        if (feed == address(0)) {
            // If there is no feed, than all another parameter must be equal to zero.
            if (bps != 0 || stalenessThreshold != 0) {
                revert EBadFeedConfig();
            }
        } else {
            // Validate the price feed.
            _checkPriceFeed(feed, bps, stalenessThreshold);
        }

        // Note: Chainlink's AggregatorV3Interface does not expose the asset pair or
        // the underlying asset on-chain. As a result, we cannot programmatically verify
        // that the price feed corresponds to the provided `asset`.
        checkers[asset] = CheckerInfo({
            priceFeed: feed,
            priceDeviationBps: bps,
            stalenessThreshold: stalenessThreshold,
            isPresent: true
        });
    }

    /// @dev Check the price feed configuration.
    /// @param feed Price feed's address.
    /// @param bps New price deviation value in basis points (e.g., 500 = 5%).
    /// @param stalenessThreshold Staleness threshold in seconds.
    function _checkPriceFeed(
        address feed,
        uint16 bps,
        uint32 stalenessThreshold
    ) internal virtual checkBPS(bps) checkStalenessThreshold(stalenessThreshold) {
        // Check that the price is present.
        _getFeedPrice(feed, stalenessThreshold);
    }
}
