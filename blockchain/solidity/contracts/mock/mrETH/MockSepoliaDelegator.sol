// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {Delegator, IDelegator} from "../../solutions/mrETH/Delegator.sol";
import {BeaconChainProofs} from "../../solutions/mrETH/external/libraries/BeaconChainProofs.sol";

/// @title Mock Delegator contract for Sepolia.
/// @notice Delegates deposits to the operator.
contract MockSepoliaDelegator is Delegator {
    /// @dev Error thrown when an operation is not supported by Sepolia.
    error EUnsupported();

    /// @inheritdoc IDelegator
    function stakeNative(
        bytes calldata,
        bytes calldata,
        bytes32
    ) external payable override only(depositManager) {
        revert EUnsupported();
    }

    /// @inheritdoc IDelegator
    function verifyWithdrawalCredentials(
        uint64,
        BeaconChainProofs.StateRootProof calldata,
        uint40[] calldata,
        bytes[] calldata,
        bytes32[][] calldata
    ) external view override only(depositManager) {
        revert EUnsupported();
    }

    /**
     * @dev Sets the `totalPendingNativeSupply` value for testing purposes.
     * @param value New value to assign to `totalPendingNativeSupply`.
     */
    function setTotalPendingNativeSupply(uint256 value) external only(depositManager) {
        totalPendingNativeSupply = value;
    }
}
