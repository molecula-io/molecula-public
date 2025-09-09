// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {PausableContractAccessControl} from "./../../../common/pausable/PausableContractAccessControl.sol";
import {IDepositManagerPool} from "./../interfaces/IDepositManagerPool.sol";

/**
 * @title PausableRedeem.
 * @dev Abstract contract that implements the pause functionality for the redeem operation.
 */
abstract contract PausableRedeem is PausableContractAccessControl {
    /// @dev Function selector for the redeem operations from the `IDepositManagerPool` interface.
    bytes4 internal constant _REDEEM_SELECTOR = IDepositManagerPool.fulfillRedeemRequests.selector;

    /// @dev Initializes the contract by registering the `redeem` function as pausable operations.
    constructor() {
        _addSelector(_REDEEM_SELECTOR);
    }

    /// @dev Pauses the `redeem` function.
    function pauseRedeem() external virtual onlyRole(GUARDIAN_ROLE) {
        _setPause(_REDEEM_SELECTOR, true);
    }

    /// @dev Unpauses the `redeem` function.
    function unpauseRedeem() external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _setPause(_REDEEM_SELECTOR, false);
    }

    /// @dev Checks if the redeem functionality is paused.
    /// @return bool `true` if the redeem is paused, `false` otherwise.
    function isRedeemPaused() public view virtual returns (bool) {
        return isFunctionPaused[_REDEEM_SELECTOR];
    }
}
