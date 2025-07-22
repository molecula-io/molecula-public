// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {_hasConvertToAssets} from "./../Utils.sol";
import {IPriceChecker} from "./interfaces/IPriceChecker.sol";

/// @title PriceCheckerClient
/// @dev Abstract contract for interacting with the price checker service.
/// @dev Inherits from Ownable to manage price checker address updates.
abstract contract PriceCheckerClient is Ownable {
    // ============ State Variables ============

    /// @dev Price checker contract's address.
    ///      Can be set to the zero address to disable price checking.
    address public priceChecker;

    // ============ Events ============

    /// @dev Emitted when the price checker address is updated.
    /// @param newPriceChecker New price checker contract address set.
    event PriceCheckerSet(address indexed newPriceChecker);

    // ============ Errors ============

    /// @dev Error: Asset mismatch.
    error EAssetMismatch();

    // ============ Modifiers ============

    /// @dev Validates that the price checker's asset matches the client's asset.
    /// @param priceChecker_ Address of the price checker contract to validate.
    modifier validateAsset(address priceChecker_) {
        if (priceChecker_ != address(0)) {
            // Check that the asset of the price checker matches the asset of the client.
            if (_hasConvertToAssets(asset())) {
                // Price checker might be checking the price of the underlying asset
                // if the price feed is not available for the token itself.

                // slither-disable-next-line reentrancy-benign
                bool is4626 = IPriceChecker(priceChecker_).isPriceFeedEIP4626();
                if (is4626) {
                    // Price checker's asset should be the same as the client's asset.
                    if (IPriceChecker(priceChecker_).asset() != asset()) {
                        revert EAssetMismatch();
                    }
                } else {
                    // Price checker might be checking the price of the underlying asset
                    // if the price feed is not available for the token itself.
                    address underlyingAsset = IERC4626(asset()).asset();
                    if (IPriceChecker(priceChecker_).asset() != underlyingAsset) {
                        revert EAssetMismatch();
                    }
                }
            } else {
                // Otherwise, the price checker's asset must be the same as the client's asset.
                if (IPriceChecker(priceChecker_).asset() != asset()) {
                    revert EAssetMismatch();
                }
            }
        }

        _;
    }

    /// @dev Initializes the contract with a price checker address.
    /// @param priceChecker_ Address of the price checker contract to use.
    constructor(address priceChecker_) validateAsset(priceChecker_) {
        priceChecker = priceChecker_;
    }

    /// @dev Updates the price checker address.
    /// @param newPriceChecker New price checker contract address.
    function setPriceChecker(
        address newPriceChecker
    ) external virtual onlyOwner validateAsset(newPriceChecker) {
        // Set the new price checker address.
        priceChecker = newPriceChecker;

        // Emit an event.
        emit PriceCheckerSet(newPriceChecker);
    }

    /// @dev Returns the address of the underlying token used for the Vault.
    ///      See also `IERC7575.asset`.
    /// @return assetTokenAddress Underlying token's address.
    function asset() public view virtual returns (address);

    /// @dev Checks the price of an asset using the price checker.
    ///      If price checker is not set (`address(0)`), this function does nothing.
    function checkPrice() public view virtual {
        if (priceChecker != address(0)) {
            IPriceChecker(priceChecker).checkPrice();
        }
    }
}
