// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {IMoleculaPoolV2WithNativeToken} from "./../../../coreV2/interfaces/IMoleculaPoolV2.sol";
import {IDelegationManager, IStrategy} from "./../external/interfaces/IDelegationManager.sol";
import {IRewardsCoordinatorTypes} from "./../external/interfaces/IRewardsCoordinator.sol";
import {BeaconChainProofs} from "./../external/libraries/BeaconChainProofs.sol";
import {IDepositManagerTypes} from "./IDepositManagerTypes.sol";
import {IStrategyLib} from "./IStrategyLib.sol";

/// @title Deposit Managers's Interface
/// @notice Defines the functions and events required for pool data management.
interface IDepositManager is IMoleculaPoolV2WithNativeToken, IDepositManagerTypes {
    /**
     * @dev Emitted when processing deposits.
     * @param token Deposit token address.
     * @param vault Token vault address.
     * @param value A deposited amount.
     */
    event Deposit(address indexed token, address indexed vault, uint256 indexed value);

    /**
     * @dev Emitted when processing deposits into EigenLayer.
     * @param value Deposit value.
     * @param pubkey A BLS12-381 public key.
     * @param signature A BLS12-381 signature.
     * @param depositDataRoot The SHA-256 hash of the SSZ-encoded DepositData object.
     */
    event StakeNative(
        uint256 indexed value,
        bytes pubkey,
        bytes signature,
        bytes32 depositDataRoot
    );

    /// @dev Emitted when the `isStakePaused` flag is changed.
    /// @param newValue New value.
    event IsStakePausedChanged(bool indexed newValue);

    /// @dev Emitted when an operator is removed from the system.
    /// @param operator Address of the removed operator.
    event OperatorRemoved(address indexed operator);

    /// @dev Emitted when the operator delegation portions are changed.
    /// @param newOperatorsArray Array of operators with new portions.
    /// @param delegationPortions Array of delegation portions for each operator.
    event OperatorsPortionsChanged(address[] newOperatorsArray, uint64[] delegationPortions);

    /// @dev Emitted when Pools are configured.
    /// @param pools Array of Pool addresses.
    /// @param newPoolsData Array of Pool configuration data.
    /// @param auth Array of boolean flags indicating the add or remove operations.
    event PoolsSet(address[] pools, PoolData[] newPoolsData, bool[] auth);

    /// @dev Emitted when the buffer percentage is changed.
    /// @param newBufferPercentage New buffer percentage value.
    event BufferPercentageChanged(uint16 indexed newBufferPercentage);

    /// @dev Emitted when the delegator implementation address is changed.
    /// @param newDelegatorImplementation New delegator implementation address.
    event DelegatorImplementationChanged(address indexed newDelegatorImplementation);

    /// @dev Emitted when the authorized staker address is changed.
    /// @param newAuthorizedStaker New authorized staker address.
    event AuthorizedStakerChanged(address indexed newAuthorizedStaker);

    /// @dev Emitted when a new operator is added to the system.
    /// @param operator Added operator's address.
    /// @param delegator Deployed delegator contract's address.
    event OperatorAdded(address indexed operator, address indexed delegator);

    /// @dev Emitted when a new strategy is added for a token.
    /// @param token Address of the token for which the strategy is added.
    /// @param strategy Strategy contract's address.
    /// @param strategyLibrary Strategy library contract's address.
    event StrategyAdded(address indexed token, IStrategy strategy, IStrategyLib strategyLibrary);

    /// @dev Emitted when a single Pool is configured.
    /// @param setPoolData SetPoolData struct.
    event PoolSet(SetPoolData setPoolData);

    /// @dev Error indicating the Deposit Manager is already initialized.
    /// @dev Error: The `Pause` status has been already set.
    error EPauseAlreadySet();

    /// @dev Error: Deposit Manager is already initialized.
    error EInitialized();

    /// @dev Error: Incorrect array length.
    error EIncorrectLength();

    /// @dev Error: Native value amount does not match `msg.value`.
    error EIncorrectNativeValue();

    /// @dev Error: Buffered amount exceeds the value stored in the buffer.
    error ENoNeedToStake();

    /// @dev Error: Value amount is not enough for a deposit into EigenLayer.
    error ETooHighDepositValue();

    /// @dev Error: Operation status is incorrect.
    error EBadOperationStatus();

    /// @dev Error: `poolId` does not match the position in the array.
    error EWrongPoolId();

    /// @dev Error: Sum of portions is not equal to `1`.
    error EWrongPortion();

    /// @dev Error: The `stake` and `delegate` functions are called while being paused as the `isStakePaused` flag is set.
    error EStakePaused();

    /// @dev Error: Attempt to remove the delegator with an active stake.
    error EDelegatorHasActiveStake();

    /// @dev Error: New token Vault does not have a strategy in the DepositManager contract.
    error EStrategyNotExists();

    /// @dev Error: Added strategy address is not whitelisted by EigenLayer or does not match the added token.
    error EInvalidStrategyConfiguration(string);

    /// @dev Error: Operator is already added to the DepositManager contract.
    error EOperatorExists();

    /// @dev Error: DepositManager contract does not have any operator for delegation.
    error EOperatorNotExists();

    /// @dev Error: Predicted clone address already has bytecode.
    error EContractAlreadyExists();

    /// @dev Error: Predicted clone address does not match the deployed clone.
    error EIncorrectPredictedAddress();

    /// @dev Error: Expected pool length is incorrect.
    error EIncorrectExpectedPoolLength();

    /**
     * @dev Initialize function.
     * @param bufferPercent_ Percentage from the TVL to be stored in the Pools.
     * @param setPoolData_ Array of SetPoolData structs.
     */
    function initialize(uint16 bufferPercent_, SetPoolData[] calldata setPoolData_) external;

    /**
     * @dev Process a deposit into the EigenLayer.
     * @param value Deposit value.
     * @param pubkey BLS12-381 public key.
     * @param signature BLS12-381 signature.
     * @param depositDataRoot SHA-256 hash of the SSZ-encoded `DepositData` object.
     */
    function stakeNative(
        uint256 value,
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external;

    /**
     * @dev Verify that one or more validators have their withdrawal credentials pointed at this EigenPod,
     * and award shares based on their effective balance. Proven validators are marked as `ACTIVE`
     * within the EigenPod, and future checkpoint proofs will need to include them.
     * @dev Withdrawal credential proofs must not be older than `currentCheckpointTimestamp`.
     * @dev Validators proven via this method must not have an exit epoch set already.
     * @param operator Address of operator for which the verification data is provided.
     * @param beaconTimestamp Beacon chain timestamp sent to the 4788 oracle contract.
     * Corresponds to the parent beacon block root against which the proof is verified.
     * @param stateRootProof Proves a beacon state root against a beacon block root.
     * @param validatorIndices List of validator indices being proven.
     * @param validatorFieldsProofs Proofs of each validator's `validatorFields` against the beacon state root
     * @param validatorFields Fields of the beacon chain "Validator" container. See consensus specs for details:
     * https://github.com/ethereum/consensus-specs/blob/dev/specs/phase0/beacon-chain.md#validator
     */
    function verifyWithdrawalCredentials(
        address operator,
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external;

    /**
     * @dev Initiates a checkpoint proof by snapshotting both the pod's ETH balance and the current block's parent block root.
     * @param operator Operator's address.
     */
    function startCheckpoint(address operator) external;

    /**
     * @dev Verifies checkpoint proofs for the currently active checkpoint and tracks the exited validator balance.
     * @param operator Operator's address.
     * @param balanceContainerProof Proves the beacon's current balance container root against a checkpoint's `beaconBlockRoot`.
     * @param proofs Proofs for one or more validator current balances against `balanceContainerRoot`.
     */
    function verifyCheckpointProofs(
        address operator,
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external;

    /**
     * @dev Undelegate shares from the old AVS operator to a new AVS operator.
     * @param oldOperator Address of the old operator to remove delegation.
     * @param newOperator Address of new operator for delegation.
     * @param approverSignatureAndExpiry Operator's signature for delegation.
     * @param approverSalt Unique data to prevent signature collisions.
     */
    function redelegate(
        address oldOperator,
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external;

    /**
     * @dev Claims rewards from EigenLayer for the specified operator using the provided merkle claim.
     * @param operator Operator's address.
     * @param claim `RewardsMerkleClaim` object to process claim.
     */
    function claimRewards(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external;

    /**
     * @dev Restakes tokens into the configured Pools.
     * @param tokens Tokens to restake.
     * @param values Amounts of tokens to restake.
     */
    function restakeRewards(address[] calldata tokens, uint256[] calldata values) external;

    /**
     * @dev Claims rewards from EigenLayer and automatically restakes them into the protocol.
     * @param operator Operator's address.
     * @param claim RewardsMerkleClaim object to process claim.
     */
    function claimRewardsAndRestake(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external;

    /**
     * @dev Picks the delegator with the TVL below the threshold or returns the first one in the list.
     * @return Address of the chosen delegator.
     */
    function chooseDelegatorForDeposit() external view returns (address);

    /**
     * @dev Getter for the Strategy contract deployed for the token.
     * @param token Address of the Strategy contract token.
     * @return strategy Address of the Strategy contract.
     */
    function getStrategy(address token) external view returns (IStrategy strategy);

    /**
     * @dev Getter for the `WithdrawalCredentials` variable for the provided operator.
     * @param delegator Contract for delegation values.
     * @return withdrawalCredentials Withdrawal credentials' bytes.
     */
    function getWithdrawalCredentials(address delegator) external view returns (bytes memory);

    /**
     * @dev Returns the formatted total supply of the protocol ETH (TVL).
     * @return res Total ETH supply.
     */
    function totalSupply() external view returns (uint256 res);

    /**
     * @dev Calculates the total buffered supply including the yield gained with the increased balances of LP tokens.
     * @return bufferedTvl Total ETH supply in buffer.
     */
    function totalBufferedSupply() external view returns (uint256 bufferedTvl);

    /**
     * @dev Calculates the available amount of WETHto deposit into the pools.
     * @return availableAmounts Array of available amounts for each pool.
     * @return totalAvailableAmount Total available amount of WETH to deposit.
     */
    function getAvailableAmountToDeposit()
        external
        view
        returns (uint256[] memory availableAmounts, uint256 totalAvailableAmount);

    /**
     * @dev calculates the yield on the increased balances of staked.
     * @return restakedTvl Total ETH supply in EigenLayer.
     * @return operatorDelegatorTVLs Array of delegators ETH supply in EigenLayer.
     */
    function totalRestakedSupply()
        external
        view
        returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs);

    /**
     * @dev Adds a new operator to the DepositManager contract with specified delegation portions.
     * @param operator Address of the new operator to add.
     * @param salt Unique salt for deterministic delegator address generation.
     * @param approverSignatureAndExpiry Operator's signature for delegation approval.
     * @param approverSalt Unique data to prevent signature collisions.
     * @param newOperatorsArray Array of operators with new portions for each pool.
     * @param newDelegationPortions Array of delegation portions for each pool.
     */
    function addOperator(
        address operator,
        bytes32 salt,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external;

    /**
     * @dev Removes an operator from the DepositManager contract and redistributes delegation portions.
     * @param operator Address of the operator to remove.
     * @param newOperatorsArray Array of operators with new portions for each pool.
     * @param newDelegationPortions Array of new delegation portions for remaining operators.
     */
    function removeOperator(
        address operator,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external;

    /**
     * @dev Sets the delegation portions for each operator in the system.
     * @param newOperatorsArray Array of operators with new portions for each pool.
     * @param delegationPortions Array of delegation portions in basis points, where 100% = 10000.
     */
    function setOperatorsPortions(
        address[] calldata newOperatorsArray,
        uint64[] calldata delegationPortions
    ) external;

    /**
     * @dev Setter Strategy contract for the token.
     * @param tokens array of LRT tokens addresses.
     * @param _strategies array of Strategy contracts' addresses.
     * @param strategyLibraries Array of strategy libraries used to convert token balances into ETH.
     */
    function addStrategies(
        address[] calldata tokens,
        IStrategy[] calldata _strategies,
        IStrategyLib[] calldata strategyLibraries
    ) external;

    /**
     * @dev Adds a single strategy for a specific token.
     * @param token Address of the token for which to add the strategy.
     * @param _strategy Address of the strategy contract to add.
     * @param strategyLibrary Address of the strategy library contract.
     */
    function addStrategy(address token, IStrategy _strategy, IStrategyLib strategyLibrary) external;

    /**
     * @dev Authorizes new Pools.
     * @param setPoolData Array of SetPoolData structs.
     * @param expectedPoolLength Expected length of the poolsArray after adding and removing.
     */
    function setPools(SetPoolData[] calldata setPoolData, uint256 expectedPoolLength) external;

    /**
     * @dev Changes poolPortions and rebalances the Buffer.
     * @param newPoolsData Array of new Pools' data.
     */
    function rebalanceBuffer(PoolData[] calldata newPoolsData) external;

    /**
     * @dev Setter for the `bufferPercentage`.
     * @param newBufferPercentage New `bufferPercentage` number.
     */
    function setBufferPercentage(uint16 newBufferPercentage) external;

    /**
     * @dev Setter for the Delegator contract implementation address.
     * @param _delegatorImplementation New delegator contract implementation address.
     */
    function setDelegatorImplementation(address _delegatorImplementation) external;

    /**
     * @dev Setter for the Authorized Staker and Restaker in the EigenLayer address.
     * @param newAuthorizedStaker New authorized Staker and Restaker address.
     */
    function setAuthorizedStaker(address newAuthorizedStaker) external;

    /// @dev Pause the `stake` and `delegate` functions.
    function pauseStake() external;

    /// @dev Unpause the `stake` and `delegate` functions.
    function unpauseStake() external;
}
