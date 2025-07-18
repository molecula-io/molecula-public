// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {DelegatorStorage, IDelegationManager, IDelegator} from "./DelegatorStorage.sol";
import {IEigenPod} from "./external/interfaces/IEigenPod.sol";
import {IRewardsCoordinatorTypes, IRewardsCoordinator} from "./external/interfaces/IRewardsCoordinator.sol";
import {IStrategy} from "./external/interfaces/IStrategy.sol";
import {BeaconChainProofs} from "./external/libraries/BeaconChainProofs.sol";

/// @title Delegator contract
/// @notice Delegates the deposits to the operator.
contract Delegator is DelegatorStorage, Initializable, ValueValidator {
    using SafeERC20 for IERC20;
    using Address for address;

    /// @inheritdoc IDelegator
    function initialize(
        IDelegationManager delegationManager_,
        address rewardsCoordinator_,
        address operator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external initializer {
        depositManager = msg.sender;

        delegationManager = delegationManager_;
        rewardsCoordinator = rewardsCoordinator_;

        // slither-disable-next-line unused-return
        delegationManager.eigenPodManager().createPod();

        delegationManager.delegateTo(operator, approverSignatureAndExpiry, approverSalt);
    }

    /// @inheritdoc IDelegator
    function stakeNative(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external payable virtual only(depositManager) {
        // Increase the ETH balance for the pending stake.
        totalPendingNativeSupply += msg.value;

        // Stake ETH into EigenLayer.
        delegationManager.eigenPodManager().stake{value: msg.value}(
            pubkey,
            signature,
            depositDataRoot
        );
    }

    /// @inheritdoc IDelegator
    function stakeToken(
        IStrategy strategy,
        IERC20 token,
        uint256 value
    ) external only(depositManager) {
        // Transfer the amount from the depositManager contract.
        // slither-disable-next-line arbitrary-send-erc20
        token.safeTransferFrom(depositManager, address(this), value);

        // Approve to the Strategy manager contract.
        token.forceApprove(address(delegationManager.strategyManager()), value);

        // Deposit LRT tokens into EigenLayer.
        // slither-disable-next-line unused-return
        delegationManager.strategyManager().depositIntoStrategy(strategy, token, value);
    }

    /// @inheritdoc IDelegator
    function verifyWithdrawalCredentials(
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external virtual only(depositManager) {
        if (totalPendingNativeSupply < STAKE_AMOUNT_NATIVE) {
            revert EIncorrectRestakeAmount();
        }

        totalPendingNativeSupply -= STAKE_AMOUNT_NATIVE;

        delegationManager.eigenPodManager().getPod(address(this)).verifyWithdrawalCredentials(
            beaconTimestamp,
            stateRootProof,
            validatorIndices,
            validatorFieldsProofs,
            validatorFields
        );
    }

    /// @inheritdoc IDelegator
    function startCheckpoint() external only(depositManager) {
        IEigenPod eigenPod = delegationManager.eigenPodManager().getPod(address(this));

        // Check if there is any active checkpoint.
        if (eigenPod.currentCheckpointTimestamp() != 0) revert ECheckpointAlreadyActive();

        // Start the checkpoint.
        eigenPod.startCheckpoint(true);
    }

    /// @inheritdoc IDelegator
    function verifyCheckpointProofs(
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external only(depositManager) {
        // Verify checkpoint proofs for validators' yield updated balance.
        delegationManager.eigenPodManager().getPod(address(this)).verifyCheckpointProofs(
            balanceContainerProof,
            proofs
        );
    }

    /// @inheritdoc IDelegator
    function redelegate(
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external only(depositManager) {
        delegationManager.delegateTo(newOperator, approverSignatureAndExpiry, approverSalt);
    }

    /// @inheritdoc IDelegator
    function claimRewards(
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external only(depositManager) {
        IRewardsCoordinator(rewardsCoordinator).processClaim(claim, depositManager);
    }
}
