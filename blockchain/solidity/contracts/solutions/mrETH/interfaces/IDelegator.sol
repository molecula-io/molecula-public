// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDelegationManager, IStrategy} from "./../external/interfaces/IDelegationManager.sol";
import {IRewardsCoordinatorTypes} from "./../external/interfaces/IRewardsCoordinator.sol";
import {BeaconChainProofs} from "./../external/libraries/BeaconChainProofs.sol";

/// @title Delegator's Interface.
/// @notice Defines the functions and events required for staking and restaking for the chosen operator.
interface IDelegator {
    /**
     * @dev Struct for queued withdrawal from EigenLayer.
     * @param sharesSlashedDelta Shares slashed delta.
     * @param delegatedTo Delegated operator's address.
     * @param nonce Withdrawal's nonce.
     * @param startBlock Block number when the withdrawal has been queued.
     * @param strategies Strategies requested for the withdrawal when it has been queued.
     * @param initialWithdrawableShares Staker's deposit shares requested for the withdrawal,
     * scaled by the staker's `depositScalingFactor`. Upon completion, these will be
     * scaled by the appropriate slashing factor as of the withdrawal's completable block.
     * The result is what is actually withdrawable.
     * @param withdrawalRoot Withdrawal's root.
     */
    struct QueuedWithdrawal {
        uint256 sharesSlashedDelta;
        address delegatedTo;
        uint32 startBlock;
        uint256 nonce;
        IStrategy[] strategies;
        uint256[] initialWithdrawableShares;
        bytes32 withdrawalRoot;
    }

    /// @dev Error: Incorrect pending ETH amount to restake.
    error EIncorrectRestakeAmount();

    /// @dev Error: Checkpoint is already active.
    error ECheckpointAlreadyActive();

    /**
     * @dev Event emitted when a withdrawal is started.
     * @param requestId Withdrawal's request ID.
     * @param staker Staker's address.
     * @param strategy Withdrawal's strategy.
     * @param sharesToWithdraw Shares to withdraw.
     */
    event WithdrawStarted(
        uint256 indexed requestId,
        address indexed staker,
        IStrategy indexed strategy,
        uint256 sharesToWithdraw
    );

    /**
     * @dev Event emitted when a withdrawal is completed.
     * @param requestId Withdrawal's request ID.
     * @param token Withdrawal's token.
     * @param shares Withdrawal's shares.
     */
    event WithdrawCompleted(
        uint256 indexed requestId,
        IERC20 indexed token,
        uint256 indexed shares
    );

    /// @dev Emitted when the operator is changed.
    /// @param newOperator New operator address.
    event OperatorChanged(address indexed newOperator);

    /**
     * @dev Initialize function.
     * @param delegationManager_ EigenLayer's contract for delegation to the operator management.
     * @param rewardsCoordinator_ EigenLayer's Reward Coordinator contract's address.
     * @param operator Account for delegation assets.
     * @param approverSignatureAndExpiry Optional. Operator's approver signature of this delegation.
     * @param approverSalt Optional. Unique single-use value tied to an individual signature.
     */
    function initialize(
        IDelegationManager delegationManager_,
        address rewardsCoordinator_,
        address operator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external;

    /**
     * @dev Process an ETH deposit into EigenLayer.
     * @param pubkey BLS12-381 public key.
     * @param signature BLS12-381 signature.
     * @param depositDataRoot SHA-256 hash of the SSZ-encoded `DepositData` object.
     */
    function stakeNative(
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external payable;

    /**
     * @dev Process a LRT tokens' deposit into EigenLayer.
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
     * @param beaconTimestamp Beacon chain timestamp sent to the 4788 Oracle contract.
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
     * @dev Initiates a checkpoint proof by snapshotting both the pod's ETH balance and the current block's parent block root.
     */
    function startCheckpoint() external;

    /**
     * @dev Verifies checkpoint proofs for the currently active checkpoint and tracks exited validator balance.
     * @param balanceContainerProof Proves the beacon's current balance container root against a checkpoint's `beaconBlockRoot`.
     * @param proofs Proofs for one or more validator current balances against `balanceContainerRoot`.
     */
    function verifyCheckpointProofs(
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external;

    /**
     * @dev Reinitialize the new operator address for delegation and redelegate all shares.
     * @param newOperator Account for redelegation of assets.
     * @param approverSignatureAndExpiry Optional. Operator's approver signature of this delegation.
     * @param approverSalt Optional. Unique single-use value tied to an individual signature.
     */
    function redelegate(
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external;

    /**
     * @dev Claim rewards from EigenLayer.
     * @param claim `RewardsMerkleClaim` object to process claim.
     */
    function claimRewards(IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim) external;

    /**
     * @dev Getter for the total amount of ETH staked into EigenLayer with the pending validator approval.
     * @return totalPendingNativeSupply Amount of pending ETH.
     */
    function totalPendingNativeSupply() external view returns (uint256);

    /**
     * @dev Getter for the total amount of tokens in ETH value staked into EigenLayer
     * with the pending validator approval.
     * @return operatorEthBalance Amount of ETH.
     */
    function delegatorSupply() external view returns (uint256 operatorEthBalance);

    /**
     * @dev Getter for the total amount of token by strategy staked into EigenLayer
     * with the pending validator approval.
     * @param strategy Strategy to get the supply for.
     * @return tokenSupply Amount of token staked.
     */
    function getDelegatorTokenSupply(
        IStrategy strategy
    ) external view returns (uint256 tokenSupply);

    /**
     * @dev Getter for the total amount of native ETH staked into EigenLayer
     * with the pending validator approval.
     * @return nativeSupply Amount of native ETH staked.
     */
    function getDelegatorNativeSupply() external view returns (uint256 nativeSupply);

    /**
     * @dev Complete queued withdrawal requests.
     * @param requestIds Request IDs.
     */
    function completeQueuedWithdrawals(uint256[] calldata requestIds) external;

    /**
     * @dev Queue a withdrawal request.
     * @param token Token to withdraw.
     * @param tokenAmount Token amount to withdraw.
     * @param strategy Strategy to withdraw.
     * @param requestId Request ID.
     * @return sharesToWithdraw Shares to withdraw.
     */
    function queueWithdrawal(
        IERC20 token,
        uint256 tokenAmount,
        IStrategy strategy,
        uint256 requestId
    ) external returns (uint256 sharesToWithdraw);
}
