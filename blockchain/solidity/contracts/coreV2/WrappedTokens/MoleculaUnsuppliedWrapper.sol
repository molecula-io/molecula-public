// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {EmptyWrappedRebaseAsset} from "./EmptyWrappedRebaseAsset.sol";
import {VoteToken} from "./VoteToken.sol";
import {WrappedRebaseAsset} from "./WrappedRebaseAsset.sol";

/// @title MoleculaUnsuppliedWrapper.
/// @notice Wrapped token can be used as a voting token.
contract MoleculaUnsuppliedWrapper is EmptyWrappedRebaseAsset, VoteToken {
    /// @dev Constructor for initializing the contract.
    /// @param name Token's name.
    /// @param symbol Token's symbol.
    /// @param owner Smart contract owner's address.
    /// @param yieldDistributor_ Authorized `yieldDistributor` address.
    /// @param bridger_ Address authorized to mint and burn tokens during the `empty` state. Maybe be the zero address.
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        address yieldDistributor_,
        address bridger_
    )
        ERC20(name, symbol)
        Ownable(owner)
        ERC20Permit(name)
        WrappedRebaseAsset(yieldDistributor_)
        EmptyWrappedRebaseAsset(bridger)
    {}

    /// @inheritdoc ERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(WrappedRebaseAsset, VoteToken) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @inheritdoc ERC20
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override(ERC20, VoteToken) {
        super._update(from, to, value);
    }
}
