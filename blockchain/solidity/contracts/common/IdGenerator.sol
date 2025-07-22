// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @title IdGenerator.
/// @notice Contract for generating operation IDs.
/// @dev Implements a counter-based ID generation system.
contract IdGenerator {
    // ============ State Variables ============

    /// @dev Last operation ID tracked by the contract.
    uint64 private _counter;

    // ============ Internal Functions ============

    /// @dev Generates an ID based on the contract address, chain ID, and counter.
    /// @return id Generated ID.
    function _generateId() internal virtual returns (uint256 id) {
        bytes32 h = keccak256(abi.encodePacked(address(this), block.chainid, _counter));
        unchecked {
            ++_counter;
        }
        return uint256(h);
    }
}
