// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {PausableContract} from "./../../common/pausable/PausableContract.sol";
import {IMetaPoolTreasury} from "./../../solutions/metaETH/interfaces/IMetaPoolTreasury.sol";

/**
 * @title PausableFulfillRedeemRequests
 * @dev Abstract contract that implements the pause functionality for the `fulfillRedeemRequests` operation.
 */
abstract contract PausableFulfillRedeemRequests is PausableContract {
    /// @dev Function selector for the `fulfillRedeemRequests` operations from the IIssuer interface.
    bytes4 internal constant _FULFILL_REDEEM_REQUESTS_SELECTOR =
        IMetaPoolTreasury.fulfillRedeemRequests.selector;

    /// @dev Initializes the contract by registering the `fulfillRedeemRequests` function as pausable operations.
    constructor() {
        _addSelector(_FULFILL_REDEEM_REQUESTS_SELECTOR);
    }

    /// @dev Pauses the `fulfillRedeemRequests` function.
    function pauseFulfillRedeemRequests() external virtual onlyAuthForPause {
        _setPause(_FULFILL_REDEEM_REQUESTS_SELECTOR, true);
    }

    /// @dev Unpauses the `fulfillRedeemRequests` function.
    function unpauseFulfillRedeemRequests() external virtual onlyOwner {
        _setPause(_FULFILL_REDEEM_REQUESTS_SELECTOR, false);
    }

    /// @dev Checks if the fulfillRedeemRequests functionality is paused.
    /// @return bool `true` if the fulfillRedeemRequests is paused, `false` otherwise.
    function isFulFillRedeemPaused() public view virtual returns (bool) {
        return isFunctionPaused[_FULFILL_REDEEM_REQUESTS_SELECTOR];
    }
}
