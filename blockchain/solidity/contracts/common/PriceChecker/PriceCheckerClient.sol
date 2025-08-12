// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
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

    // ============ Constructor ============

    /// @dev Initializes the contract with a price checker address.
    /// @param priceChecker_ Address of the price checker contract to use. It can be the zero address.
    constructor(address priceChecker_) {
        priceChecker = priceChecker_;
    }

    // ============ Setters ============

    /// @dev Updates the price checker address.
    /// @param newPriceChecker New price checker contract address.
    function setPriceChecker(address newPriceChecker) public virtual onlyOwner {
        // Set the new price checker address.
        priceChecker = newPriceChecker;

        // Emit an event.
        emit PriceCheckerSet(newPriceChecker);
    }

    // ============ View Functions ============

    /// @dev This function delegates the price check to the price checker contract if one is set.
    /// @param asset Address of the asset to check the price for.
    function checkPrice(address asset) public view virtual {
        if (priceChecker != address(0)) {
            // If a price feed is set for the token, then check that the token price is within the allowed deviation.
            // If the price feed is not set but the asset is present, do nothing.
            // Otherwise, throw an exception.
            IPriceChecker(priceChecker).checkPrice(asset);
        }
    }

    /// @dev Validates that the price checker is properly set and has the specified asset.
    /// @param asset Asset address to validate in the price checker.
    /// @notice Validation is skipped if either the price checker or the asset is the zero address.
    function _validatePriceChecker(address asset) internal view {
        if (priceChecker != address(0) && asset != address(0)) {
            IPriceChecker(priceChecker).ensureHasPriceFeed(asset);
        }
    }
}
