// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {PriceCheckerClient} from "./../../common/PriceChecker/PriceCheckerClient.sol";

abstract contract VaultPriceChecker is PriceCheckerClient {
    /// @dev This function delegates the price check to the price checker contract if one is set.
    modifier validatePrice() {
        checkPrice(address(this));
        _;
    }

    /// @inheritdoc PriceCheckerClient
    function setPriceChecker(address newPriceChecker) public virtual override {
        super.setPriceChecker(newPriceChecker);
        _validatePriceChecker(asset());
    }

    /// @dev Returns the address of the underlying token used for the Vault.
    ///      See also `IERC7575.asset`.
    /// @return assetTokenAddress Underlying token's address.
    function asset() public view virtual returns (address);
}
