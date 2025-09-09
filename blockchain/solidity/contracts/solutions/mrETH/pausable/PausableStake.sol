// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {PausableContractAccessControl} from "./../../../common/pausable/PausableContractAccessControl.sol";
import {IDepositManagerRestaker} from "./../interfaces/IDepositManagerRestaker.sol";

/**
 * @title PausableStake.
 * @dev Abstract contract that implements the pause functionality for the stake operation.
 */
abstract contract PausableStake is PausableContractAccessControl {
    /// @dev Function selector for the stake operations from the `IDepositManagerRestaker` interface.
    bytes4 internal constant _STAKE_SELECTOR = IDepositManagerRestaker.stakeNative.selector;

    /// @dev Initializes the contract by registering the `stake` function as pausable operations.
    constructor() {
        _addSelector(_STAKE_SELECTOR);
    }

    /// @dev Pauses the `stake` function.
    function pauseStake() external virtual onlyRole(GUARDIAN_ROLE) {
        _setPause(_STAKE_SELECTOR, true);
    }

    /// @dev Unpauses the `stake` function.
    function unpauseStake() external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _setPause(_STAKE_SELECTOR, false);
    }

    /// @dev Checks if the stake functionality is paused.
    /// @return bool `true` if the stake is paused, `false` otherwise.
    function isStakePaused() public view virtual returns (bool) {
        return isFunctionPaused[_STAKE_SELECTOR];
    }
}
