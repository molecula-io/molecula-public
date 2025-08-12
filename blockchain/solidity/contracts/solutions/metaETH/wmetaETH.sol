// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {WrappedRebaseToken} from "../../coreV2/WrappedTokens/WrappedRebaseToken.sol";

contract WmetaETH is WrappedRebaseToken {
    /// @dev Initializes the `RewardBearingToken` contract.
    /// @param name_ Token's name.
    /// @param symbol_ Token's symbol.
    /// @param rebaseToken_ Rebase token's address.
    constructor(
        string memory name_,
        string memory symbol_,
        address rebaseToken_
    ) ERC20(name_, symbol_) EIP712(name_, "2.0.0") WrappedRebaseToken(rebaseToken_) {}
}
