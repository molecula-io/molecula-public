// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {_getDecimalsOr18, _hasConvertToAssets, _normalize} from "./../Utils.sol";
import {ValueValidator} from "./../ValueValidator.sol";
import {IPriceChecker} from "./interfaces/IPriceChecker.sol";

/// @title PriceChecker
/// @dev Check for pair kind of `(USDc, USDe, sUSDe) / USD`; `(stETH) / ETH`, etc.
contract PriceChecker is IPriceChecker, Ownable2Step, ValueValidator {
    // ============ State Variables ============

    /// @dev Minimal staleness threshold.
    uint32 internal constant _MIN_STALENESS_THRESHOLD = 15 seconds;

    /// @dev Maximal staleness threshold.
    uint32 internal constant _MAX_STALENESS_THRESHOLD = 7 days;

    /// @dev Maps asset addresses to their price checker configurations.
    mapping(address asset => CheckerInfo) public checkers;

    // ============ Modifiers ============

    /// @dev Checks that the asset is an EIP-4626 asset if the price feed is for an EIP-4626 asset.
    /// @param asset_ Address of the asset to check the price for.
    /// @param isPriceFeedEIP4626_ Boolean flag indicating if the price feed is for an EIP-4626 asset.
    modifier checkForEIP4626Asset(address asset_, bool isPriceFeedEIP4626_) {
        if (isPriceFeedEIP4626_ && !_hasConvertToAssets(asset_)) {
            revert ENotEIP4626Asset();
        }
        _;
    }

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
    constructor(Checkers[] memory checkers_, address initialOwner) Ownable(initialOwner) {
        uint256 length = checkers_.length;
        for (uint256 i = 0; i < length; ++i) {
            Checkers memory checker = checkers_[i];
            if (checkers[checker.asset].isPresent) {
                revert ECheckerAlreadyPresent();
            }
            _setPriceFeed(
                checker.asset,
                checker.priceFeed,
                checker.isPriceFeedEIP4626,
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
        bool is4626,
        uint16 bps,
        uint32 stalenessThreshold
    ) public virtual override onlyOwner {
        // Check that the new price feed configuration is the same as the previous one.
        CheckerInfo storage checkerInfo = checkers[asset];
        if (
            checkerInfo.priceFeed == feed &&
            checkerInfo.isPriceFeedEIP4626 == is4626 &&
            checkerInfo.priceDeviationBps == bps &&
            checkerInfo.stalenessThreshold == stalenessThreshold
        ) {
            revert ESameValue();
        }

        // Set the new price feed configuration.
        _setPriceFeed(asset, feed, is4626, bps, stalenessThreshold);

        // Emit an event to log the operation.
        emit PriceFeedConfigured(asset, feed, is4626, bps, stalenessThreshold);
    }

    /// @inheritdoc IPriceChecker
    function changePriceDeviationBps(
        address asset,
        uint16 bps
    ) external virtual override onlyOwner checkBPS(bps) {
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

    /// @dev Checks that the underlying asset price is around 1 USD (1 ETH, 1 BTC, etc.), within the allowed deviation.
    ///      If a price feed is set for the token, then check that the token price is within the allowed deviation.
    ///      If the price feed is not set but the asset is present, do nothing.
    ///      Otherwise, throw an exception.
    ///
    ///      Check might be performed on the EIP-4626 token's underlying asset if:
    ///          - The TokenVault uses an EIP-4626 token as its underlying asset.
    ///          - The price feed is not available for the token itself.
    /// @param asset Address of the asset to check the price for.
    function checkPrice(address asset) external view virtual override {
        CheckerInfo storage checkerInfo = _getPriceCheckerOrThrow(asset);

        // No need to check the price for assets with no price feed as it's OK for native tokens (ETH)
        // or pegged tokens (wETH), and some other tokens to not have a price feed.
        if (checkerInfo.priceFeed == address(0)) {
            return;
        }

        // Find the expected price for the asset, in the units of the price feed.
        uint256 expectedPrice;
        uint8 feedDecimals = AggregatorV3Interface(checkerInfo.priceFeed).decimals();
        // If the price feed is for an EIP-4626 asset (i.e., a Vault token),
        // we need to determine how much of the underlying asset one Vault token represents,
        // and then normalize that amount to the price feed's decimals.
        if (checkerInfo.isPriceFeedEIP4626) {
            // Convert one Vault token to the amount of the underlying asset it represents.
            // This should be an expected price of the asset which is yet to be normalized
            // to match the decimals of the price feed.
            uint256 oneUnit4626 = uint256(10) ** _getDecimalsOr18(asset);
            expectedPrice = IERC4626(asset).convertToAssets(oneUnit4626);

            // Get the decimals for the underlying asset.
            address underlyingAsset = IERC4626(asset).asset();
            uint8 underlyingAssetDecimals = _getDecimalsOr18(underlyingAsset);

            // Normalize the expected price to match the decimals of the price feed.
            expectedPrice = _normalize(expectedPrice, underlyingAssetDecimals, feedDecimals);
        } else {
            // The expected price is one unit in feed decimals (e.g., 1 USD or 1 ETH).
            expectedPrice = uint256(10) ** feedDecimals;
        }

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
            revert EPriceNotSet();
        }

        // Check if the price feed data is stale based on the configured threshold.
        if (updatedAt + stalenessThreshold < block.timestamp) {
            revert EChainlinkPriceFeedStale();
        }
    }

    /// @dev Set the price feed address, type, and allowed price deviation in basis points.
    /// @param asset Address of the asset to set price feed for.
    /// @param feed Price feed's address.
    /// @param is4626 `True` if it is an EIP-4626 asset feed.
    /// @param bps New price deviation value in basis points (e.g., 500 = 5%).
    /// @param stalenessThreshold Staleness threshold in seconds.
    function _setPriceFeed(
        address asset,
        address feed,
        bool is4626,
        uint16 bps,
        uint32 stalenessThreshold
    ) internal virtual notZeroAddress(asset) {
        if (feed == address(0)) {
            // If there is no feed, than all another parameter must be equal to zero.
            if (is4626 || bps != 0 || stalenessThreshold != 0) {
                revert EBadFeedConfig();
            }
        } else {
            // Validate the price feed.
            _checkPriceFeed(asset, feed, is4626, bps, stalenessThreshold);
        }

        // Note: Chainlink's AggregatorV3Interface does not expose the asset pair or
        // the underlying asset on-chain. As a result, we cannot programmatically verify
        // that the price feed corresponds to the provided `_asset`, or to the underlying
        // asset of `_asset` if it's an EIP-4626 token.

        checkers[asset] = CheckerInfo({
            priceFeed: feed,
            isPriceFeedEIP4626: is4626,
            priceDeviationBps: bps,
            stalenessThreshold: stalenessThreshold,
            isPresent: true
        });
    }

    /// @dev Check the price feed configuration.
    /// @param asset Address of the asset to set a price feed for.
    /// @param feed Price feed's address.
    /// @param is4626 `True` if it is an EIP-4626 asset feed.
    /// @param bps New price deviation value in basis points (e.g., 500 = 5%).
    /// @param stalenessThreshold Staleness threshold in seconds.
    function _checkPriceFeed(
        address asset,
        address feed,
        bool is4626,
        uint16 bps,
        uint32 stalenessThreshold
    )
        internal
        virtual
        checkForEIP4626Asset(asset, is4626)
        checkBPS(bps)
        checkStalenessThreshold(stalenessThreshold)
    {
        // Check that the price is present.
        _getFeedPrice(feed, stalenessThreshold);
    }
}
