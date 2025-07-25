// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {VoteCandyAsset} from "./../../coreV2/WrappedTokens/VoteCandyAsset.sol";

contract WmETH is VoteCandyAsset {
    /// @dev Constructor for initializing the contract.
    /// @param name Token's name.
    /// @param symbol Token's symbol.
    /// @param owner Smart contract owner's address.
    /// @param rebaseToken_ Rebase token's address.
    /// @param yieldDistributor_ Authorized Yield Distributor's address.
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        address rebaseToken_,
        address yieldDistributor_
    ) VoteCandyAsset(name, symbol, owner, rebaseToken_, yieldDistributor_) {}
}
