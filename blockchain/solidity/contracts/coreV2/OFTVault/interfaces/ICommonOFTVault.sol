// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/**
 * @title ICommonOFTVault.
 * @notice Interface for the CommonOFTVault cross-chain bridging contract.
 */
interface ICommonOFTVault {
    // ============ Errors ============

    /// @dev Error thrown when the message payload is invalid or malformed.
    error InvalidMessage();

    // ============ Functions ============

    /**
     * @notice Bridges shares to another chain using LayerZero.
     * @dev Encodes payload based on the local chain. Includes the Oracle data if from Ethereum.
     *      Burns shares on the current chain, emits bridge events, and sends message via LayerZero.
     * @param shares Amount of shares to bridge.
     * @param receiver Address to receive the shares on the destination chain.
     * @param owner Address whose shares will be burned.
     * @param dstEid LayerZero endpoint ID of the destination chain.
     */
    function bridge(
        uint256 shares,
        address receiver,
        address owner,
        uint32 dstEid
    ) external payable;
}
