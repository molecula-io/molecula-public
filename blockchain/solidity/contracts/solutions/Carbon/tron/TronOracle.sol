// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {CommonOracle} from "../../../common/CommonOracle.sol";

/**
 * @title TronOracle.
 * @notice Exact Oracle implementation for managing the Pool and share supply, with controlled
 *         access via the Owner, Updater, and Accountant roles.
 * @dev Inherits from `CommonOracle`.
 *      Allows only authorized Updaters or the Accountant to set both the Pool and share values.
 */
contract TronOracle is CommonOracle {
    // ============ Constructor ============

    /**
     * @notice Contract constructor that initializes the shares, Pool, Owner, Accountant, and initial authorized updater.
     * @dev Calls `CommonOracle` constructor for base initialization.
     * @param initialShares Initial share value.
     * @param initialPool Initial Pool value.
     * @param initialOwner Address to set as the contract Owner.
     * @param authorizedUpdaterAddress Address to set as the initial authorized Updater.
     */
    constructor(
        uint256 initialShares,
        uint256 initialPool,
        address initialOwner,
        address authorizedUpdaterAddress
    ) CommonOracle(initialShares, initialPool, initialOwner) {
        _setUpdaterAuthorization(authorizedUpdaterAddress, true);
    }
}
