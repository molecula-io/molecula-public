// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.23;

import {RebaseTokenOwner} from "../../../common/rebase/RebaseTokenOwner.sol";

contract TronRebaseTokenOwner is RebaseTokenOwner {
    // ============ Constructor ============

    /// @dev Initializes the contract.
    /// @param initialOwner Owner's address.
    /// @param rebaseTokenAddress Rebase token's address.
    /// @param guardianAddress Address of the Guardian that can pause the contract.
    constructor(
        address initialOwner,
        address rebaseTokenAddress,
        address guardianAddress
    ) RebaseTokenOwner(initialOwner, rebaseTokenAddress, guardianAddress) {}
}
