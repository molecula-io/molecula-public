/**
 * Links to the original contracts:
 * - https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/src/contracts/interfaces/IAVSRegistrar.sol
 * - https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/src/contracts/interfaces/IAllocationManager.sol
 */
// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.5.0;

import {OperatorSet} from "../libraries/OperatorSetLib.sol";
import "./IPauserRegistry.sol";
import "./IStrategy.sol";

interface IAVSRegistrar {
    /**
     * @notice Called by the AllocationManager when an operator wants to register
     * for one or more operator sets. This method should revert if registration is unsuccessful.
     * @param operator Registering operator.
     * @param avs AVS for which the operator is registering. Must be the same as `IAVSRegistrar.avs()`.
     * @param operatorSetIds List of operator set IDs being registered.
     * @param data Arbitrary data the operator can provide as part of registration.
     */
    function registerOperator(
        address operator,
        address avs,
        uint32[] calldata operatorSetIds,
        bytes calldata data
    ) external;

    /**
     * @notice Called by the AllocationManager when an operator is deregistered from
     * one or more operator sets. If this method reverts, it is ignored.
     * @param operator Deregistering operator.
     * @param avs AVS for which operator is deregistering. Must be the same as `IAVSRegistrar.avs()`.
     * @param operatorSetIds List of operator set IDs being deregistered.
     */
    function deregisterOperator(
        address operator,
        address avs,
        uint32[] calldata operatorSetIds
    ) external;

    /**
     * @notice Returns `true` if the AVS is supported by the registrar.
     * @param avs AVS to check.
     * @return true If the AVS is supported, returns `true`, `false` otherwise
     */
    function supportsAVS(address avs) external view returns (bool);
}

interface IAllocationManagerErrors {
    /// Input Validation.

    /// @dev Error: `wadToSlash` is zero or greater than 1e18.
    error InvalidWadToSlash();
    /// @dev Error: Two array parameters have mismatching lengths.
    error InputArrayLengthMismatch();
    /// @dev Error: AVSRegistrar not correctly configured to prevent an AVSRegistrar contract
    /// from being used with the wrong AVS.
    error InvalidAVSRegistrar();
    /// @dev Error: Invalid strategy provided.
    error InvalidStrategy();

    /// Caller.

    /// @dev Error: Caller not authorized to call the function.
    error InvalidCaller();

    /// Operator Status.

    /// @dev Error: Invalid operator provided.
    error InvalidOperator();
    /// @dev Error: Invalid AVS with non-registered metadata provided.
    error NonexistentAVSMetadata();
    /// @dev Error: Operator's allocation delay hasn not been set yet.
    error UninitializedAllocationDelay();
    /// @dev Error: Attempt to slash an operator when they are not slashable.
    error OperatorNotSlashable();
    /// @dev Error: Attempt to add an operator to a set they are already a member of.
    error AlreadyMemberOfSet();
    /// @dev Error: Attempt to slash or remove an operator from a set they are not a member of.
    error NotMemberOfSet();

    /// Operator Set Status.

    /// @dev Error: Invalid operator set provided.
    error InvalidOperatorSet();
    /// @dev Error: Provided `strategies` are not in ascending order.
    error StrategiesMustBeInAscendingOrder();
    /// @dev Error: Attempt to add a strategy to an operator set that already contains it.
    error StrategyAlreadyInOperatorSet();
    /// @dev Error: Strategy referenced does not belong to an operator set.
    error StrategyNotInOperatorSet();

    /// Modifying Allocations.

    /// @dev Error: Operator attempts to set their allocation for `operatorSet` with the same value.
    error SameMagnitude();
    /// @dev Error: Allocation attempted for a given operator when they have pending allocations or deallocations.
    error ModificationAlreadyPending();
    /// @dev Error: Allocation attempted that exceeds a given operator's total allocatable magnitude.
    error InsufficientMagnitude();
}

interface IAllocationManagerTypes {
    /**
     * @notice Defines allocation information from a strategy for an operator set.
     * @param currentMagnitude Current magnitude allocated from the strategy to the operator set.
     * @param pendingDiff Pending change in magnitude, if exists, or `0` otherwise.
     * @param effectBlock Block at which the pending magnitude difference will take effect.
     */
    struct Allocation {
        uint64 currentMagnitude;
        int128 pendingDiff;
        uint32 effectBlock;
    }

    /**
     * @notice Struct containing allocation delay metadata for a given operator.
     * @param delay Current allocation delay.
     * @param isSet Flag indicating whether the operator has initially set an allocation delay.
     * Note: Value can be `false`. However, once `block.number >= effectBlock`, the allocation delay
     * is treated as configured and in effect.
     * @param pendingDelay Delay that will take effect after `effectBlock`.
     * @param effectBlock Block number after which a pending delay will take effect.
     */
    struct AllocationDelayInfo {
        uint32 delay;
        bool isSet;
        uint32 pendingDelay;
        uint32 effectBlock;
    }

    /**
     * @notice Contains registration details for an operator pertaining to an operator set.
     * @param registered Flag indicating whether the operator is currently registered for the operator set.
     * @param slashableUntil If the operator is not registered, it is still slashable until reaching the block.
     */
    struct RegistrationStatus {
        bool registered;
        uint32 slashableUntil;
    }

    /**
     * @notice Contains allocation info for a specific strategy.
     * @param maxMagnitude Maximum magnitude that can be allocated between all operator sets.
     * @param encumberedMagnitude Currently allocated magnitude for the strategy.
     */
    struct StrategyInfo {
        uint64 maxMagnitude;
        uint64 encumberedMagnitude;
    }

    /**
     * @notice Struct containing parameters to slashing.
     * @param operator Address to slash.
     * @param operatorSetId operatorSet ID on behalf of which the operator is being slashed.
     * @param strategies Set of strategies to slash.
     * @param wadsToSlash Parts in 1e18 to slash. Proportional to the operator's
     * slashable stake allocation for `operatorSet`.
     * @param description Description of the slashing provided by the AVS for legibility.
     */
    struct SlashingParams {
        address operator;
        uint32 operatorSetId;
        IStrategy[] strategies;
        uint256[] wadsToSlash;
        string description;
    }

    /**
     * @notice Struct used to modify the allocation of slashable magnitude to an operator set.
     * @param operatorSet Operator set to modify the allocation for.
     * @param strategies Strategies to modify allocations for.
     * @param newMagnitudes New magnitude to allocate for each strategy to this operator set.
     */
    struct AllocateParams {
        OperatorSet operatorSet;
        IStrategy[] strategies;
        uint64[] newMagnitudes;
    }

    /**
     * @notice Parameters used to register for an AVS's operator sets.
     * @param avs AVS being registered.
     * @param operatorSetIds Operator sets within the AVS to register.
     * @param data Extra data to be passed to the AVS to complete registration.
     */
    struct RegisterParams {
        address avs;
        uint32[] operatorSetIds;
        bytes data;
    }

    /**
     * @notice Parameters used to deregister from an AVS's operator sets.
     * @param operator Operator being deregistered.
     * @param avs AVS being deregistered.
     * @param operatorSetIds Operator sets within the AVS being deregistered.
     */
    struct DeregisterParams {
        address operator;
        address avs;
        uint32[] operatorSetIds;
    }

    /**
     * @notice Parameters used by an AVS to create new operator sets.
     * @param operatorSetId ID of the operator set to create.
     * @param strategies Strategies to add as slashable to the operator set.
     */
    struct CreateSetParams {
        uint32 operatorSetId;
        IStrategy[] strategies;
    }
}

interface IAllocationManagerEvents is IAllocationManagerTypes {
    /// @notice Emitted when operator updates their allocation delay.
    event AllocationDelaySet(address operator, uint32 delay, uint32 effectBlock);

    /// @notice Emitted when an operator's magnitude is updated for a given `operatorSet` and strategy.
    event AllocationUpdated(
        address operator,
        OperatorSet operatorSet,
        IStrategy strategy,
        uint64 magnitude,
        uint32 effectBlock
    );

    /// @notice Emitted when operator's encumbered magnitude is updated for a given strategy.
    event EncumberedMagnitudeUpdated(
        address operator,
        IStrategy strategy,
        uint64 encumberedMagnitude
    );

    /// @notice Emitted when an operator's max magnitude is updated for a given strategy.
    event MaxMagnitudeUpdated(address operator, IStrategy strategy, uint64 maxMagnitude);

    /// @notice Emitted when an operator is slashed by an operator set for a strategy.
    /// `wadSlashed` is the proportion of the operator's total delegated stake slashed.
    event OperatorSlashed(
        address operator,
        OperatorSet operatorSet,
        IStrategy[] strategies,
        uint256[] wadSlashed,
        string description
    );

    /// @notice Emitted when an AVS configures the address that will handle registration and deregistration.
    event AVSRegistrarSet(address avs, IAVSRegistrar registrar);

    /// @notice Emitted when an AVS updates their metadata URI (Uniform Resource Identifier).
    /// @dev URI is never stored, while being emitted through an event for off-chain indexing.
    event AVSMetadataURIUpdated(address indexed avs, string metadataURI);

    /// @notice Emitted when an operator set is created by an AVS.
    event OperatorSetCreated(OperatorSet operatorSet);

    /// @notice Emitted when an operator is added to an operator set.
    event OperatorAddedToOperatorSet(address indexed operator, OperatorSet operatorSet);

    /// @notice Emitted when an operator is removed from an operator set.
    event OperatorRemovedFromOperatorSet(address indexed operator, OperatorSet operatorSet);

    /// @notice Emitted when a redistributing operator set is created by an AVS.
    event RedistributionAddressSet(OperatorSet operatorSet, address redistributionRecipient);

    /// @notice Emitted when a strategy is added to an operator set.
    event StrategyAddedToOperatorSet(OperatorSet operatorSet, IStrategy strategy);

    /// @notice Emitted when a strategy is removed from an operator set.
    event StrategyRemovedFromOperatorSet(OperatorSet operatorSet, IStrategy strategy);
}

interface IAllocationManager is IAllocationManagerErrors, IAllocationManagerEvents {
    /**
     * @dev Initializes the initial owner and paused status.
     */
    function initialize(uint256 initialPausedStatus) external;

    /**
     * @notice Called by an AVS to slash an operator in a given operator set. The operator must be registered
     * and have slashable stake allocated to the operator set.
     *
     * @param avs AVS address initiating the slash.
     * @param params Slashing parameters, containing:
     *  - `operator`: Operator to slash.
     *  - `operatorSetId`: ID of the operator set the operator is being slashed from.
     *  - `strategies`: Array of strategies to slash allocations from. Must be in ascending order.
     *  - `wadsToSlash`: Array of proportions to slash from each strategy. Must be between 0 and 1e18.
     *  - `description`: Description of why the operator is slashed.
     *
     * @return slashId Slash ID.
     * @return shares Amount of shares slashed for each strategy.
     *
     * @dev For each strategy:
     *      1. Reduces the operator's current allocation magnitude by the `wadToSlash` proportion.
     *      2. Reduces the strategy's maximum and encumbered magnitudes proportionally.
     *      3. If there is a pending deallocation, reduces it proportionally.
     *      4. Updates the operator's shares in the DelegationManager.
     *
     * @dev Small slashing amounts may not result in actual token burning due to rounding.
     *      This will result in small amounts of tokens locked in the contract
     *      rather than fully burning through the burn mechanism.
     */
    function slashOperator(
        address avs,
        SlashingParams calldata params
    ) external returns (uint256 slashId, uint256[] memory shares);

    /**
     * @notice Modifies the proportions of slashable stake allocated to an operator set from a list of strategies.
     * Note: Deallocations remain slashable for `DEALLOCATION_DELAY` blocks. Therefore, when they
     * are cleared, they may free up less allocatable magnitude initially deallocated.
     * @param operator Operator for allocation modifications.
     * @param params Array of magnitude adjustments for one or more operator sets.
     * @dev Updates `encumberedMagnitude` for the updated strategies.
     */
    function modifyAllocations(address operator, AllocateParams[] calldata params) external;

    /**
     * @notice This function performs for each strategy:
     * - Removal from `deallocationQueue` all clearable deallocations up to the maximum `numToClear` number of deallocations.
     * - Update of the `encumberedMagnitude` of the operator.
     * @param operator Address for clearing deallocations.
     * @param strategies List of strategies for clearing deallocations.
     * @param numToClear List of number of pending deallocations to clear for each strategy.
     *
     * @dev Can be called permissionlessly by anyone.
     */
    function clearDeallocationQueue(
        address operator,
        IStrategy[] calldata strategies,
        uint16[] calldata numToClear
    ) external;

    /**
     * @notice Allows an operator to register for one or more operator sets within an AVS. If the operator
     * has any stake allocated to these operator sets, it immediately becomes slashable.
     * @dev After registering within the ALM, this method calls the AVS Registrar's `IAVSRegistrar.registerOperator`
     * method to complete registration. This call must succeed for registration to be successful.
     */
    function registerForOperatorSets(address operator, RegisterParams calldata params) external;

    /**
     * @notice Allows an operator or AVS to deregister the operator from one or more of the AVS's operator sets.
     * If the operator has any slashable stake allocated to the AVS, it remains slashable until
     * `DEALLOCATION_DELAY` has passed.
     * @dev After deregistering within the ALM, this method calls the AVS Registrar's `IAVSRegistrar.deregisterOperator`
     * method to complete deregistration. This call must succeed for deregistration to be successful.
     */
    function deregisterFromOperatorSets(DeregisterParams calldata params) external;

    /**
     * @notice Called by the delegation manager or an operator to set an operator's allocation delay.
     * This is set:
     * - When the operator first registers.
     * - The number of blocks becomes slashable between:
     *   - An operator allocating magnitude to an operator set.
     *   - A magnitude value.
     * @param operator Operator to set the delay on behalf of.
     * @param delay Allocation delay in blocks.
     */
    function setAllocationDelay(address operator, uint32 delay) external;

    /**
     * @notice Called by an AVS to configure the address that is called when an operator registers
     * or is being deregistered from the AVS's operator sets. If not set, or set to 0, defaults to the AVS's address.
     * @param registrar New registrar address.
     */
    function setAVSRegistrar(address avs, IAVSRegistrar registrar) external;

    /**
     * @notice Called by an AVS to emit an `AVSMetadataURIUpdated` event indicating the information has been updated.
     * @param metadataURI URI for metadata associated with an AVS.
     * @dev Note: `metadataURI` is never stored, while being emitted in the `AVSMetadataURIUpdated` event.
     */
    function updateAVSMetadataURI(address avs, string calldata metadataURI) external;

    /**
     * @notice Allows an AVS to create new operator sets, defining strategies that the operator set uses.
     */
    function createOperatorSets(address avs, CreateSetParams[] calldata params) external;

    /**
     * @notice Allows an AVS to create new Redistribution operator sets.
     * @param avs AVS creating the new operator sets.
     * @param params Array of operator set creation parameters.
     * @param redistributionRecipients Array of addresses that will receive redistributed funds when operators are slashed.
     * @dev Same logic as `createOperatorSets`, except `redistributionRecipients` corresponding to each operator set are stored.
     *      Additionally, emits a `RedistributionOperatorSetCreated` event instead of `OperatorSetCreated` for each created operator set.
     */
    function createRedistributingOperatorSets(
        address avs,
        CreateSetParams[] calldata params,
        address[] calldata redistributionRecipients
    ) external;

    /**
     * @notice Allows an AVS to add strategies to an operator set.
     * @dev Strategies must not already exist in the operator set.
     * @dev If `operatorSet` is redistributing, `BEACONCHAIN_ETH_STRAT` may not be added,
     * as redistribution is not supported for the native ETH.
     * @param avs AVS for setting strategies.
     * @param operatorSetId Operator set for adding strategies.
     * @param strategies Strategies to add.
     */
    function addStrategiesToOperatorSet(
        address avs,
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external;

    /**
     * @notice Allows an AVS to remove strategies from an operator set.
     * @dev Strategies must already exist in the operator set.
     * @param avs AVS for removing strategies.
     * @param operatorSetId Operator set for removing strategies.
     * @param strategies Strategies to remove.
     */
    function removeStrategiesFromOperatorSet(
        address avs,
        uint32 operatorSetId,
        IStrategy[] calldata strategies
    ) external;

    /**
     *
     * VIEW FUNCTIONS
     *
     */

    /**
     * @notice Returns the number of operator sets for the AVS.
     * @param avs AVS to query.
     */
    function getOperatorSetCount(address avs) external view returns (uint256);

    /**
     * @notice Returns the list of operator sets the operator has current or pending allocations or deallocations in.
     * @param operator Operator to query.
     * @return OperatorSet[] List of operator sets the operator has current or pending allocations or deallocations in.
     */
    function getAllocatedSets(address operator) external view returns (OperatorSet[] memory);

    /**
     * @notice Returns the list of strategies an operator has current or pending allocations or deallocations
     * from given a specific operator set.
     * @param operator Operator to query.
     * @param operatorSet Operator set to query.
     * @return IStrategy[] List of strategies.
     */
    function getAllocatedStrategies(
        address operator,
        OperatorSet memory operatorSet
    ) external view returns (IStrategy[] memory);

    /**
     * @notice Returns the current or pending stake allocation an operator has from a strategy to an operator set.
     * @param operator Operator to query.
     * @param operatorSet Operator set to query.
     * @param strategy Strategy to query.
     * @return Allocation Current or pending stake allocation.
     */
    function getAllocation(
        address operator,
        OperatorSet memory operatorSet,
        IStrategy strategy
    ) external view returns (Allocation memory);

    /**
     * @notice Returns the current or pending stake allocations for multiple operators from a strategy to an operator set.
     * @param operators Operators to query.
     * @param operatorSet Operator set to query.
     * @param strategy Strategy to query.
     * @return Allocation[] Each operator's allocation.
     */
    function getAllocations(
        address[] memory operators,
        OperatorSet memory operatorSet,
        IStrategy strategy
    ) external view returns (Allocation[] memory);

    /**
     * @notice Given the strategy, returns a list of operator sets and their corresponding stake allocations.
     * @dev Note: This returns a list of all operator sets the operator has allocations in.
     * Some of the returned allocations may be zero.
     * @param operator Operator to query.
     * @param strategy Strategy to query.
     * @return OperatorSet[] List of all operator sets the operator has allocations for.
     * @return Allocation[] Corresponding list of allocations from the specific strategy.
     */
    function getStrategyAllocations(
        address operator,
        IStrategy strategy
    ) external view returns (OperatorSet[] memory, Allocation[] memory);

    /**
     * @notice For a strategy, get the amount of magnitude that is allocated across one or more operator sets.
     * @param operator Operator to query.
     * @param strategy Strategy for getting allocatable magnitude.
     * @return uint64 Currently allocated magnitude.
     */
    function getEncumberedMagnitude(
        address operator,
        IStrategy strategy
    ) external view returns (uint64);

    /**
     * @notice For a strategy, get the amount of magnitude not currently allocated to any operator set.
     * @param operator Operator to query.
     * @param strategy Strategy for getting allocatable magnitude.
     * @return uint64 Magnitude available to be allocated to an operator set.
     */
    function getAllocatableMagnitude(
        address operator,
        IStrategy strategy
    ) external view returns (uint64);

    /**
     * @notice Returns the maximum magnitude an operator can allocate for the given strategy.
     * @dev The maximum magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the maximum magnitude of the operator.
     * @param operator Operator to query.
     * @param strategy Strategy for getting the maximum magnitude.
     * @return uint64 Maximum magnitude for the strategy.
     */
    function getMaxMagnitude(address operator, IStrategy strategy) external view returns (uint64);

    /**
     * @notice Returns the maximum magnitude an operator can allocate for the given strategies.
     * @dev Maximum magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the maximum magnitude of the operator.
     * @param operator Operator to query.
     * @param strategies Strategies for getting the maximum magnitudes.
     * @return uint64[] Maximum magnitude for each strategy.
     */
    function getMaxMagnitudes(
        address operator,
        IStrategy[] calldata strategies
    ) external view returns (uint64[] memory);

    /**
     * @notice Returns the maximum magnitudes each operator can allocate for the given strategy.
     * @dev Maximum magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the maximum magnitude of the operator.
     * @param operators Operators to query.
     * @param strategy Strategy for getting the maximum magnitude.
     * @return uint64[] Maximum magnitudes for each operator
     */
    function getMaxMagnitudes(
        address[] calldata operators,
        IStrategy strategy
    ) external view returns (uint64[] memory);

    /**
     * @notice Returns the maximum magnitude an operator can allocate for the given strategies
     * at a given block number.
     * @dev Maximum magnitude of an operator starts at WAD (1e18), and is decreased anytime
     * the operator is slashed. This value acts as a cap on the maximum magnitude of the operator.
     * @param operator Operator to query.
     * @param strategies Strategies for getting the maximum magnitudes.
     * @param blockNumber Block number for checking the maximum magnitude.
     * @return uint64[] Maximum magnitude for each strategy.
     */
    function getMaxMagnitudesAtBlock(
        address operator,
        IStrategy[] calldata strategies,
        uint32 blockNumber
    ) external view returns (uint64[] memory);

    /**
     * @notice Returns the time in blocks between an operator allocating slashable magnitude
     * and the magnitude becoming slashable. If the delay has not been set, `isSet` will be `false`.
     * @dev Operator must have a configured delay before allocating magnitude.
     * @param operator Operator to query.
     * @return isSet Flag indicating whether the operator has configured a delay.
     * @return delay Time in blocks between allocating magnitude and magnitude becoming slashable.
     */
    function getAllocationDelay(address operator) external view returns (bool isSet, uint32 delay);

    /**
     * @notice Returns the number of blocks between an operator deallocating magnitude and the magnitude becoming
     * unslashable and then being able to be reallocated to another operator set. Note: Unlike the allocation delay
     * which is configurable by the operator, `DEALLOCATION_DELAY` is globally fixed and cannot be changed.
     */
    function DEALLOCATION_DELAY() external view returns (uint32 delay);

    /**
     * @notice Returns a list of all operator sets the operator is registered for.
     * @param operator Operator address to query.
     */
    function getRegisteredSets(
        address operator
    ) external view returns (OperatorSet[] memory operatorSets);

    /**
     * @notice Returns a boolean whether the operator is registered for the operator set.
     * @param operator Operator to query.
     * @param operatorSet Operator set to query.
     */
    function isMemberOfOperatorSet(
        address operator,
        OperatorSet memory operatorSet
    ) external view returns (bool);

    /**
     * @notice Returns a boolean whether the operator set exists.
     */
    function isOperatorSet(OperatorSet memory operatorSet) external view returns (bool);

    /**
     * @notice Returns all the operators registered to an operator set.
     * @param operatorSet `operatorSet` to query.
     */
    function getMembers(
        OperatorSet memory operatorSet
    ) external view returns (address[] memory operators);

    /**
     * @notice Returns the number of operators registered to `operatorSet`.
     * @param operatorSet `operatorSet` for getting the member count.
     */
    function getMemberCount(OperatorSet memory operatorSet) external view returns (uint256);

    /**
     * @notice Returns the address that handles registration or deregistration for the AVS.
     * If not set, defaults to the input address (`avs`).
     */
    function getAVSRegistrar(address avs) external view returns (IAVSRegistrar);

    /**
     * @notice Returns an array of strategies in `operatorSet`.
     * @param operatorSet `OperatorSet` to query.
     */
    function getStrategiesInOperatorSet(
        OperatorSet memory operatorSet
    ) external view returns (IStrategy[] memory strategies);

    /**
     * @notice Returns the minimum amount of stake that will be slashable as of some future block,
     * according to each operator's allocation from each strategy to the operator set. Note: This function
     * will return 0 for the slashable stake if the operator is not slashable at the time of the call.
     * @dev This method queries actual delegated stakes in the DelegationManager and applies
     * each operator's allocation to the stake to produce the slashable stake each allocation
     * represents. This method does not consider slashable stake in the withdrawal queue even though
     * there could be slashable stake in the queue.
     * @dev This minimum takes into account `futureBlock`, and will omit any pending magnitude
     * differences that will not be in effect as of `futureBlock`. Note: To get the true
     * minimum slashable stake as of some future block, `futureBlock` must be greater than `block.number`.
     * @dev Note: `futureBlock` must be fewer blocks than `DEALLOCATION_DELAY` in the future,
     * or the values returned from this method may not be accurate due to deallocations.
     * @param operatorSet Operator set to query.
     * @param operators List of operators whose slashable stakes will be returned.
     * @param strategies Strategies that each slashable stake corresponds to.
     * @param futureBlock Block at which to get allocation information. Must be a future block.
     */
    function getMinimumSlashableStake(
        OperatorSet memory operatorSet,
        address[] memory operators,
        IStrategy[] memory strategies,
        uint32 futureBlock
    ) external view returns (uint256[][] memory slashableStake);

    /**
     * @notice Returns the current allocated stake, irrespective of the operator's slashable status for `operatorSet`.
     * @param operatorSet Operator set to query.
     * @param operators Operators to query.
     * @param strategies Strategies to query.
     */
    function getAllocatedStake(
        OperatorSet memory operatorSet,
        address[] memory operators,
        IStrategy[] memory strategies
    ) external view returns (uint256[][] memory slashableStake);

    /**
     * @notice Returns whether an operator is slashable by an operator set.
     * This returns `true` if the operator is registered or their `slashableUntil` block has not passed.
     * As operators are being deregistered, they still remain slashable for a period of time.
     * @param operator Operator for checking slashability.
     * @param operatorSet Operator set for checking slashability.
     */
    function isOperatorSlashable(
        address operator,
        OperatorSet memory operatorSet
    ) external view returns (bool);

    /**
     * @notice Returns the address where slashed funds will be sent for a given operator set.
     * @param operatorSet `operatorSet` to query.
     * @return address For a redistributing `operatorSet` during its creation, returns the configured redistribution address set.
     *         For non-redistributing operator sets, returns `DEFAULT_BURN_ADDRESS`.
     */
    function getRedistributionRecipient(
        OperatorSet memory operatorSet
    ) external view returns (address);

    /**
     * @notice Returns a boolean whether a given operator set supports redistribution
     * when funds are slashed and burned by EigenLayer.
     * @param operatorSet `operatorSet` to query.
     * @return For a redistributing `operatorSet`, returns `true`.
     *         For a non-redistributing `operatorSet`, returns `false`.
     */
    function isRedistributingOperatorSet(
        OperatorSet memory operatorSet
    ) external view returns (bool);

    /**
     * @notice Returns the number of slashes for a given operator set.
     * @param operatorSet Operator set to query.
     * @return Number of slashes for the operator set.
     */
    function getSlashCount(OperatorSet memory operatorSet) external view returns (uint256);

    /**
     * @notice Returns a boolean whether an operator is slashable by a redistributing operator set.
     * @param operator Operator to query.
     */
    function isOperatorRedistributable(address operator) external view returns (bool);
}
