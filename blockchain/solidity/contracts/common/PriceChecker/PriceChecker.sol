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

    /// @dev Address of the asset to check the price for.
    address internal immutable _ASSET;

    /// @inheritdoc IPriceChecker
    address public priceFeed;

    /// @inheritdoc IPriceChecker
    bool public isPriceFeedEIP4626;

    /// @inheritdoc IPriceChecker
    uint16 public priceDeviationBps;

    // ============ Modifiers ============

    /// @dev Checks that the asset is an EIP-4626 asset if the price feed is for an EIP-4626 asset.
    /// @param asset_ Address of the asset to check the price for.
    /// @param isPriceFeedEIP4626_ Flag indicating if the price feed is for an EIP-4626 asset.
    modifier checkForEIP4626Asset(address asset_, bool isPriceFeedEIP4626_) {
        if (isPriceFeedEIP4626_ && !_hasConvertToAssets(asset_)) {
            revert ENotEIP4626Asset();
        }
        _;
    }

    // ============ Constructor ============

    /// @notice Initializes the PriceChecker contract.
    /// @dev Sets up the initial configuration for the price checking functionality.
    /// @param asset_ Address of the asset to check the price for.
    ///     If `isPriceFeedEIP4626` is `true`, this should be an EIP-4626 Vault token address.
    /// @param priceFeed_ Address of the Chainlink price feed contract.
    /// @param isPriceFeedEIP4626_ Flag indicating if the price feed is for an EIP-4626 asset.
    /// @param priceDeviationBps_ Maximum allowed price deviation in basis points (e.g., 500 = 5%).
    /// @param initialOwner Address of the initial contract owner.
    constructor(
        address asset_,
        address priceFeed_,
        bool isPriceFeedEIP4626_,
        uint16 priceDeviationBps_,
        address initialOwner
    )
        notZeroAddress(asset_)
        notZeroAddress(priceFeed_)
        checkBPS(priceDeviationBps_)
        checkForEIP4626Asset(asset_, isPriceFeedEIP4626_)
        Ownable(initialOwner)
    {
        _ASSET = asset_;
        priceFeed = priceFeed_;
        isPriceFeedEIP4626 = isPriceFeedEIP4626_;
        priceDeviationBps = priceDeviationBps_;
    }

    // ============ Core Functions ============

    /// @inheritdoc IPriceChecker
    function setPriceDeviationBps(uint16 bps) external virtual override onlyOwner {
        bool changed = _setPriceDeviationBps(bps);
        if (!changed) {
            revert ESameValue();
        }
    }

    /// @inheritdoc IPriceChecker
    function setPriceFeed(address feed, bool is4626) external virtual override onlyOwner {
        bool changed = _setPriceFeed(feed, is4626);
        if (!changed) {
            revert ESameValue();
        }
    }

    /// @inheritdoc IPriceChecker
    function removePriceFeed() external virtual override onlyOwner {
        if (priceFeed == address(0)) {
            revert ESameValue();
        }
        priceFeed = address(0);
        emit PriceFeedRemoved();
    }

    /// @inheritdoc IPriceChecker
    function setPriceFeedAndBps(
        address feed,
        bool is4626,
        uint16 bps
    ) external virtual override onlyOwner {
        bool changedFeed = _setPriceFeed(feed, is4626);
        bool changedBps = _setPriceDeviationBps(bps);
        if (!changedFeed && !changedBps) {
            revert ESameValue();
        }
    }

    // ============ View Functions ============

    /// @inheritdoc IPriceChecker
    function asset() external view override returns (address) {
        return _ASSET;
    }

    /// @dev Checks that the underlying asset price is around 1 USD (1 ETH, 1 BTC, etc.), within the allowed deviation.
    /// @notice Check might be performed on the EIP-4626 token's underlying asset if:
    /// - The TokenVault uses an EIP-4626 token as its underlying asset.
    /// - The price feed is not available for the token itself.
    function checkPrice() external view {
        // Find the expected price for the asset, in the units of the price feed.
        uint256 expectedPrice;
        uint8 feedDecimals = AggregatorV3Interface(priceFeed).decimals();
        // If the price feed is for an EIP-4626 asset (i.e., a Vault token),
        // we need to determine how much of the underlying asset one Vault token represents,
        // and then normalize that amount to the price feed's decimals.
        if (isPriceFeedEIP4626) {
            // Get the EIP-4626 Vault token address.
            address erc4626 = _ASSET;

            // Convert one Vault token to the amount of the underlying asset it represents.
            // This should be an expected price of the asset which is yet to be normalized
            // to match the decimals of the price feed.
            uint256 oneUnit4626 = uint256(10) ** _getDecimalsOr18(erc4626);
            expectedPrice = IERC4626(erc4626).convertToAssets(oneUnit4626);

            // Get the decimals for the underlying asset.
            address underlyingAsset = IERC4626(erc4626).asset();
            uint8 underlyingAssetDecimals = _getDecimalsOr18(underlyingAsset);

            // Normalize the expected price to match the decimals of the price feed.
            expectedPrice = _normalize(expectedPrice, underlyingAssetDecimals, feedDecimals);
        } else {
            // The expected price is one unit in feed decimals (e.g., 1 USD or 1 ETH).
            expectedPrice = uint256(10) ** feedDecimals;
        }

        // Get the asset price.
        uint256 assetPrice = uint256(_checkAndGetFeedPrice(priceFeed));

        uint256 absDiff = assetPrice > expectedPrice
            ? assetPrice - expectedPrice
            : expectedPrice - assetPrice;

        // Check that the price is approximately equal to the expected price, within the allowed deviation.
        // Formula of the relative error for the acceptable price:
        // `|assetPrice - expectedPrice| / expectedPrice < epsilon`
        // `|assetPrice - expectedPrice| / expectedPrice < priceDeviationBps / 10_000`
        // `|assetPrice - expectedPrice| * 10_000 < priceDeviationBps * expectedPrice`
        if (absDiff * ConstantsCoreV2.PERCENTAGE_FACTOR > priceDeviationBps * expectedPrice) {
            revert EAssetPriceNotCloseToExpected(assetPrice, expectedPrice, priceDeviationBps);
        }
    }

    // ============ Internal Functions ============

    /// @dev Gets the latest price from a Chainlink price feed and validates it.
    /// @param feed Address of the Chainlink price feed contract.
    /// @return price Latest price from the feed, reverts if the price is negative.
    function _checkAndGetFeedPrice(address feed) internal view virtual returns (int256 price) {
        // Check that the price is present.
        // slither-disable-next-line unused-return
        (, price, , , ) = AggregatorV3Interface(feed).latestRoundData();
        if (price <= 0) {
            revert EPriceNotSet();
        }
    }

    /// @dev Set the price feed address and type.
    /// @param feed Price feed's address.
    /// @param is4626 `True` if it is an EIP-4626 asset feed.
    /// @return changed `True` if the feed configuration is changed, `false` if the same values are provided.
    function _setPriceFeed(
        address feed,
        bool is4626
    ) internal notZeroAddress(feed) checkForEIP4626Asset(_ASSET, is4626) returns (bool changed) {
        if (priceFeed != feed || isPriceFeedEIP4626 != is4626) {
            // Check that the price is present.
            _checkAndGetFeedPrice(feed);

            // Note: Chainlink's AggregatorV3Interface does not expose the asset pair or
            // the underlying asset on-chain. As a result, we cannot programmatically verify
            // that the price feed corresponds to the provided `_asset`, or to the underlying
            // asset of `_asset` if it's an EIP-4626 token.

            // Set the price feed configuration.
            priceFeed = feed;
            isPriceFeedEIP4626 = is4626;

            // Emit an event to log the operation.
            emit PriceFeedConfigured(feed, is4626);

            changed = true;
        }
    }

    /// @dev Sets the allowed price deviation in basis points.
    /// @param bps New price deviation value in basis points (e.g., 500 = 5%).
    /// @return changed `True` if the value is changed, false if the same value are provided.
    function _setPriceDeviationBps(
        uint16 bps
    ) internal virtual checkBPS(bps) returns (bool changed) {
        uint16 oldBps = priceDeviationBps;
        if (oldBps != bps) {
            // Set the price deviation in basis points.
            priceDeviationBps = bps;

            // Emit an event to log the operation.
            emit PriceDeviationBpsSet(oldBps, bps);

            changed = true;
        }
    }
}
