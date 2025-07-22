// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {PausableContract} from "./../../common/pausable/PausableContract.sol";
import {IERC7540Deposit, IERC7540Redeem} from "./../external/interfaces/IERC7540.sol";

abstract contract PausableVault is PausableContract {
    /// @dev Function selector for the deposit operations.
    bytes4 internal constant _DEPOSIT_SELECTOR = IERC7540Deposit.deposit.selector;

    /// @dev Function selector for the redemption request operations.
    bytes4 internal constant _REQUEST_REDEEM_SELECTOR = IERC7540Redeem.requestRedeem.selector;

    /// @dev Initializes the contract by registering the `deposit` and `requestRedeem` functions.
    constructor() {
        _addSelector(_DEPOSIT_SELECTOR);
        _addSelector(_REQUEST_REDEEM_SELECTOR);
    }

    /// @dev Pauses the `requestDeposit` function and other enter functions.
    function pauseRequestDeposit() external virtual onlyAuthForPause {
        _setPause(_DEPOSIT_SELECTOR, true);
    }

    /// @dev Unpauses the `requestDeposit` function.
    function unpauseRequestDeposit() external virtual onlyOwner {
        _setPause(_DEPOSIT_SELECTOR, false);
    }

    /// @dev Pauses the `requestRedeem` function.
    function pauseRequestRedeem() external virtual onlyAuthForPause {
        _setPause(_REQUEST_REDEEM_SELECTOR, true);
    }

    /// @dev Unpauses the `requestRedeem` function.
    function unpauseRequestRedeem() external virtual onlyOwner {
        _setPause(_REQUEST_REDEEM_SELECTOR, false);
    }

    /// @dev Checks if the request deposit functionality is paused.
    /// @return bool `true` if the request deposit is paused, `false` otherwise.
    function isRequestDepositPaused() external view virtual returns (bool) {
        return isFunctionPaused[_DEPOSIT_SELECTOR];
    }

    /// @dev Checks if the request redeem functionality is paused.
    /// @return bool `true` if the request redeem is paused, `false` otherwise.
    function isRequestRedeemPaused() external view virtual returns (bool) {
        return isFunctionPaused[_REQUEST_REDEEM_SELECTOR];
    }
}
