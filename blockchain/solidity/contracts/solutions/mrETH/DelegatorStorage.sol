// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IDelegationManager} from "./external/interfaces/IDelegationManager.sol";
import {IDelegator} from "./interfaces/IDelegator.sol";

/// @title Delegator Storage.
/// @notice Storage contract for the Delegator contract.
abstract contract DelegatorStorage is IDelegator {
    /// @dev Maximum stake amount cap per validator.
    uint256 public constant STAKE_AMOUNT_NATIVE = 32 ether;

    /// @dev EigenLayer Reward Coordinator contract's address.
    address public rewardsCoordinator;

    /// @dev Deposit Manager Pool contract's address.
    address public depositManagerPool;

    /// @dev EigenLayer restaking contract's address.
    IDelegationManager public delegationManager;

    /// @dev Actual operator address.
    address public operator;

    /// @dev Total amount of ETH staked into EigenLayer with the pending validator approval.
    uint256 public totalPendingNativeSupply;

    /// @dev Tracks slashed delta for `queuedWithdrawal`.
    mapping(uint256 requestId => QueuedWithdrawal queuedWithdrawal) public queuedWithdrawalInfo;

    /// @dev Mapping of token shares in the EigenLayer's withdrawal queue.
    mapping(address token => uint256 totalQueuedShares) public queuedShares;
}
