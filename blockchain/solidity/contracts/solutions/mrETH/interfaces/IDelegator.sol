// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDelegationManager, IStrategy} from "../external/interfaces/IDelegationManager.sol";
import {BeaconChainProofs} from "../external/libraries/BeaconChainProofs.sol";

/// @title Delegator's Interface
/// @notice Defines the functions and events required for staking and restaking for the chosen operator.
interface IDelegator {
    /// @dev Error: `msg.sender` is not authorized for this function.
    error EBadSender();

    /// @dev Error: incorrect pending ETH amount to restake.
    error EIncorrectRestakeAmount();

    /**
     * @dev Initialize function.
     * @param delegationManager_ EigenLayer's contract for delegation to the operator management.
     * @param operator Account for delegation assets.
     * @param approverSignatureAndExpiry Optional. Operator's approver signature of this delegation.
     * @param approverSalt Optional. A unique single-use value tied to an individual signature.
     */
    function initialize(
        IDelegationManager delegationManager_,
        address operator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external;

    /**
     * @dev Process a deposit of ETH into EigenLayer.
     * @param pubkey BLS12-381 public key.
     * @param signature BLS12-381 signature.
     * @param depositDataRoot SHA-256 hash of the SSZ-encoded DepositData object.
     */
    function stakeNative(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external payable;

    /**
     * @dev Process a deposit of LRT tokens into EigenLayer.
     * @param strategy Address of EigenLayer's token Vault.
     * @param token Deposit token's address.
     * @param value Amount to deposit.
     */
    function stakeToken(IStrategy strategy, IERC20 token, uint256 value) external;

    /**
     * @dev Verify that one or more validators have their withdrawal credentials pointed at this EigenPod,
     * and award shares based on their effective balance. Proven validators are marked as `ACTIVE`
     * within the EigenPod, and future checkpoint proofs will need to include them.
     * @dev Withdrawal credential proofs must not be older than `currentCheckpointTimestamp`.
     * @dev Validators proven via this method must not have an exit epoch set already.
     * @param beaconTimestamp Beacon chain timestamp sent to the 4788 oracle contract.
     * Corresponds to the parent beacon block root against which the proof is verified.
     * @param stateRootProof Proves a beacon state root against a beacon block root.
     * @param validatorIndices List of validator indices being proven.
     * @param validatorFieldsProofs Proofs of each validator's `validatorFields` against the beacon state root.
     * @param validatorFields Fields of the beacon chain "Validator" container. See the consensus spec for details:
     * https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#validator
     */
    function verifyWithdrawalCredentials(
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external;

    /**
     * @dev Reinitialize the new operator address for delegation and redelegate all shares.
     * @param newOperator Account for redelegation of assets.
     * @param approverSignatureAndExpiry Optional. Operator's approver signature of this delegation.
     * @param approverSalt Optional. A unique single-use value tied to an individual signature.
     */
    function redelegate(
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external;

    /**
     * @dev Getter for the total amount of ETH staked into EigenLayer with the pending validator approval.
     * @return totalPendingNativeSupply Amount of pending ETH.
     */
    function totalPendingNativeSupply() external view returns (uint256);
}
