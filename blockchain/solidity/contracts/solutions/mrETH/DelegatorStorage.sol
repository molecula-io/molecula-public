// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {IDelegationManager} from "./external/interfaces/IDelegationManager.sol";
import {IDelegator} from "./interfaces/IDelegator.sol";

/// @title Delegator Storage
/// @notice Storage contract for the Delegator contract.
abstract contract DelegatorStorage is IDelegator {
    /// @dev Maximum stake amount cap per validator.
    uint256 public constant STAKE_AMOUNT_NATIVE = 32 ether;

    /// @dev EigenLayer Reward Coordinator contract's address.
    address public rewardsCoordinator;

    /// @dev Deposit Manager contract's address.
    address public depositManager;

    /// @dev EigenLayer restaking contract's address.
    IDelegationManager public delegationManager;

    /// @dev Total amount of ETH staked into EigenLayer with the pending validator approval.
    uint256 public totalPendingNativeSupply;
}
