// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.24;

import {IIssuer} from "./../coreV2/interfaces/IIssuer.sol";
import {IwmUSDEmpty} from "./interfaces/IwmUSDEmpty.sol";
import {WMUSD} from "./wmUSD.sol";

/// @notice wmUSD Empty
contract WMUSDEmpty is WMUSD, IIssuer, IwmUSDEmpty {
    // ============ State Variables ============

    /// @dev IwmUSDEmpty
    address public bridger;

    // ============ Modifiers ============

    /// @dev Ensures that the contract is in an empty state (mUSD address is not set).
    modifier ensureEmpty() {
        if (mUSD != address(0)) {
            revert EContractIsAlreadyCandy();
        }
        _;
    }

    // ============ Constructor ============

    /// @dev Constructor for initializing the contract.
    /// @param name Token name.
    /// @param symbol Token symbol.
    /// @param owner Smart contract owner address.
    /// @param yieldDistributorAddress Authorized `yieldDistributor` address.
    /// @param bridger_ Address authorized to mint and burn tokens during the empty state. Maybe be zero address.
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        address yieldDistributorAddress,
        address bridger_
    ) WMUSD(name, symbol, owner, address(0), yieldDistributorAddress) {
        bridger = bridger_;
    }

    // ============ Bridger Functions ============

    /// @inheritdoc IIssuer
    function mint(
        address user,
        uint256 wmUSDAmount
    ) external virtual override ensureEmpty only(bridger) {
        _mint(user, wmUSDAmount);
    }

    /// @inheritdoc IIssuer
    function burn(
        address user,
        uint256 wmUSDAmount
    ) external virtual override ensureEmpty only(bridger) {
        _burn(user, wmUSDAmount);
    }

    /// @inheritdoc IwmUSDEmpty
    function turnToCandy(
        address mUSD_
    ) external virtual override ensureEmpty only(bridger) notZeroAddress(mUSD_) {
        // Remove the bridger
        _setBridger(address(0));

        // Set the mUSD address.
        mUSD = mUSD_;

        // Emit an event to log the turn to candy operation.
        emit TurnedToCandy(mUSD_);
    }

    // ============ Owner Functions ============

    /// @inheritdoc IwmUSDEmpty
    function setBridger(
        address bridger_
    ) external virtual override ensureEmpty onlyOwner notZeroAddress(bridger_) {
        _setBridger(bridger_);
    }

    // ============ Internal Functions ============

    /// @dev Sets a new bridger address
    /// @param bridger_ The address of the new bridger
    function _setBridger(address bridger_) internal virtual {
        address oldBridger = bridger;
        bridger = bridger_;
        emit BridgerSet(oldBridger, bridger_);
    }
}
