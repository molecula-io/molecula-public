// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.23;

/// @title ConstantsCoreV2
/// @notice Library containing core constants used across the protocol.
/// @dev Contains immutable values that are frequently used in other contracts.
library ConstantsCoreV2 {
    /// @notice Special address used to represent the native token (e.g., ETH) according to EIP-7528:
    ///         https://eips.ethereum.org/EIPS/eip-7528
    /// @dev This pseudo-address is commonly used to differentiate between ERC20 tokens and the native tokens.
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @dev Basis points factor, where 100% = 10,000.
    /// Used as a denominator in percentage calculations.
    uint16 public constant PERCENTAGE_FACTOR = 10_000;
}
