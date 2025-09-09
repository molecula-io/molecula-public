// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ValueValidator} from "./../ValueValidator.sol";

/// @title PausableContractAccessControl.
/// @notice Abstract contract for managing function that pauses the functionality with the access control.
/// @dev Implements pausable functions with the `GUARDIAN_ROLE` and `DEFAULT_ADMIN_ROLE` controls.
abstract contract PausableContractAccessControl is AccessControl, ValueValidator {
    // ============ State Variables ============

    /// @dev Role for the Guardian.
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    /// @dev Mapping of function selectors to their pause status.
    mapping(bytes4 functionSelector => bool isPaused) public isFunctionPaused;

    /// @dev Array of function selectors that can be paused.
    /// @notice Stores all registered function selectors that can be controlled by the pause functionality.
    bytes4[] public selectors;

    // ============ Events ============

    /// @dev Emitted when a function's pause status changes.
    /// @param functionSelector Function selector that is changed.
    /// @param isPaused New pause status.
    event PausedChanged(bytes4 indexed functionSelector, bool indexed isPaused);

    // ============ Errors ============

    /// @dev Error thrown when trying to set the `isPaused` status that is already set.
    /// @param functionSelector Function selector attempted to be set.
    /// @param isPaused Status attempted to be set.
    error EAlreadySet(bytes4 functionSelector, bool isPaused);

    /// @dev Error thrown when trying to set all functions to the `isPaused` status that they already have.
    /// @param isPaused Status attempted to be set.
    error EAllAlreadySet(bool isPaused);

    /// @dev Error thrown when a paused function is called.
    /// @param functionSelector Function selector that is paused.
    error EFunctionPaused(bytes4 functionSelector);

    // ============ Modifiers ============

    /// @dev Ensures the function is not paused.
    /// @param functionSelector Function selector to check.
    modifier checkNotPause(bytes4 functionSelector) {
        if (isFunctionPaused[functionSelector]) {
            revert EFunctionPaused(functionSelector);
        }
        _;
    }

    // ============ Admin Functions ============

    /// @dev Pauses all registered functions.
    function pauseAll() external virtual onlyRole(GUARDIAN_ROLE) {
        _setPauseAll(true);
    }

    /// @dev Unpauses all registered functions.
    function unpauseAll() external virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _setPauseAll(false);
    }

    // ============ Internal Functions ============

    /// @dev Adds a function selector to the list of pausable functions.
    /// @param selector Function selector to be added to the list.
    // slither-disable-next-line dead-code
    function _addSelector(bytes4 selector) internal virtual {
        selectors.push(selector);
    }

    /// @dev Sets the pause status for a function. If a pause status is already set, throws an exception.
    /// @param functionSelector Function selector to update.
    /// @param isPaused New pause status.
    function _setPause(bytes4 functionSelector, bool isPaused) internal virtual {
        _setPauseOptional(functionSelector, isPaused, true);
    }

    /// @dev Sets the pause status for a function with optional exception throwing.
    /// @param functionSelector Function selector to update.
    /// @param isPaused New pause status.
    /// @param throwException If `true`, throws an exception when a status is already set.
    /// @return changed Returns `true` if the pause status has changed, `false` otherwise.
    function _setPauseOptional(
        bytes4 functionSelector,
        bool isPaused,
        bool throwException
    ) internal virtual returns (bool changed) {
        if (isFunctionPaused[functionSelector] == isPaused) {
            if (throwException) revert EAlreadySet(functionSelector, isPaused);
            return false;
        }
        isFunctionPaused[functionSelector] = isPaused;
        emit PausedChanged(functionSelector, isPaused);
        return true;
    }

    /// @dev Iterates through all registered selectors and updates their pause status.
    ///      Throws `EAllAlreadySet` if no function's status has changed.
    /// @param isPaused New pause status to be set for all functions.
    function _setPauseAll(bool isPaused) internal virtual {
        uint256 length = selectors.length;
        bool changed = false;
        for (uint256 i = 0; i < length; ++i) {
            changed = _setPauseOptional(selectors[i], isPaused, false) || changed;
        }
        if (!changed) {
            revert EAllAlreadySet(isPaused);
        }
    }
}
