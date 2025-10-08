// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {AggregatorV3Interface} from "./../common/PriceChecker/externals/AggregatorV3Interface.sol";
import {PriceChecker} from "./../common/PriceChecker/PriceChecker.sol";
import {_getDecimalsOr18, _normalize} from "./../common/Utils.sol";
import {MoleculaPoolTreasuryV2, TokenType} from "./../core/MoleculaPoolTreasuryV2.sol";
import {ConstantsCoreV2} from "./../coreV2/Constants.sol";

/// @title PoolPriceChecker.
/// @dev Similar to `PriceChecker` but uses:
///      - A token instead of the Vault.
///      - The Molecula Pool to get token information.
contract PoolPriceChecker is PriceChecker {
    // ============ State Variables ============

    /// @dev Molecula Pool's address.
    address public immutable MOLECULA_POOL;

    // ============ Errors ============

    /// @dev No asset in the Molecula Pool.
    /// @param asset Asset's address.
    error EUnknownAsset(address asset);

    // ============ Constructor ============

    /// @notice Initializes the `PriceChecker` contract.
    /// @dev Sets up the initial configuration for the price checking functionality.
    /// @param checkers_ Array of initial price checker configurations to set up.
    /// @param initialOwner Initial contract owner's address.
    /// @param moleculaTokenDecimals Molecula token decimals.
    /// @param moleculaPool_ Molecula Pool's address.
    constructor(
        Checkers[] memory checkers_,
        address initialOwner,
        uint8 moleculaTokenDecimals,
        address moleculaPool_
    ) PriceChecker(checkers_, initialOwner, moleculaTokenDecimals) notZeroAddress(moleculaPool_) {
        MOLECULA_POOL = moleculaPool_;
    }

    // ============ View Functions ============

    /// @dev Checks that the underlying asset price is around 1 USD (1 ETH, 1 BTC, etc.), within the allowed deviation.
    ///      If a price feed is set for the token, check that the token price is within the allowed deviation.
    ///      If the price feed is not set but the asset is present, do nothing.
    ///      Otherwise, throw an exception.
    /// @param asset Address of the asset to check the price for.
    function checkPrice(address asset) external view virtual override {
        CheckerInfo storage checkerInfo = _getPriceCheckerOrThrow(asset);

        // No need to check the price for assets with no price feed as it's OK for native tokens (ETH)
        // or pegged tokens (wETH), and some other tokens to not have a price feed.
        if (checkerInfo.priceFeed == address(0)) {
            return;
        }

        // Find the expected price for the asset, in the units of the price feed.
        uint256 expectedPrice = 0;
        uint8 feedDecimals = AggregatorV3Interface(checkerInfo.priceFeed).decimals();

        // Get the token configuration from the Pool map.
        // slither-disable-next-line unused-return
        (TokenType tokenType, , int8 n, , ) = MoleculaPoolTreasuryV2(MOLECULA_POOL).poolMap(asset);

        // If the price feed is for an EIP-4626 asset (i.e., a Vault token),
        // we need to determine how much of the underlying asset one Vault token represents,
        // and then normalize that amount to the price feed's decimals.
        if (tokenType == TokenType.ERC4626) {
            // Convert one Vault token to the amount of the underlying asset it represents.
            // This should be an expected price of the asset which is yet to be normalized
            // to match the decimals of the price feed.
            uint256 oneUnit4626 = uint256(10) ** _getDecimalsOr18(asset);
            expectedPrice = IERC4626(asset).convertToAssets(oneUnit4626);

            // Get the decimals for the underlying asset.
            uint8 underlyingAssetDecimals = 18 - uint8(n);

            // Normalize the expected price to match the decimals of the price feed.
            expectedPrice = _normalize(expectedPrice, underlyingAssetDecimals, feedDecimals);
        } else if (tokenType == TokenType.ERC20) {
            // The expected price is one unit in feed decimals (e.g., 1 USD or 1 ETH).
            expectedPrice = uint256(10) ** feedDecimals;
        } else {
            revert EUnknownAsset(asset);
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
}
