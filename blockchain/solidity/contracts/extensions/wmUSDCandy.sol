// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.24;

import {WMUSD} from "./wmUSD.sol";

/// @notice wmUSD Candy
contract WMUSDCandy is WMUSD {
    /// @dev Constructor for initializing the contract.
    /// @param name Token name.
    /// @param symbol Token symbol.
    /// @param owner Smart contract owner address.
    /// @param mUSD_ Rebase token's address.
    /// @param yieldDistributorAddress Authorized `yieldDistributor` address.
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        address mUSD_,
        address yieldDistributorAddress
    ) WMUSD(name, symbol, owner, mUSD_, yieldDistributorAddress) notZeroAddress(mUSD_) {}
}
