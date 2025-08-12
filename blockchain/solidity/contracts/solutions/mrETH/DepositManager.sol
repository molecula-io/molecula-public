// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Guardian} from "./../../common/pausable/Guardian.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {IERC7575} from "./../../coreV2/external/interfaces/IERC7575.sol";
import {IMoleculaPoolV2} from "./../../coreV2/interfaces/IMoleculaPoolV2.sol";
import {DepositManagerStorage, IDelegationManager, IStrategyFactory} from "./DepositManagerStorage.sol";
import {IEigenPodManager} from "./external/interfaces/IEigenPodManager.sol";
import {IRewardsCoordinatorTypes} from "./external/interfaces/IRewardsCoordinator.sol";
import {IStrategy, IStrategyManager} from "./external/interfaces/IStrategyManager.sol";
import {IWETH} from "./external/interfaces/IWETH.sol";
import {IBufferInteractor} from "./interfaces/IBufferInteractor.sol";
import {IDelegator} from "./interfaces/IDelegator.sol";
import {IDepositManager, BeaconChainProofs, IMoleculaPoolV2WithNativeToken, IStrategyLib} from "./interfaces/IDepositManager.sol";

/**
 * @title Deposit Manager
 * @notice Manages deposits, withdrawals, and Pool operations for the mrETH protocol.
 * @dev This contract handles:
 * - Deposit and withdrawal of ETH, WETH, and other tokens.
 * - Pool management and rebalancing.
 * - Operator delegation and staking.
 * - Buffer management for maintaining liquidity.
 */
contract DepositManager is
    DepositManagerStorage,
    IDepositManager,
    Ownable2Step,
    Initializable,
    Guardian
{
    using SafeERC20 for IERC20;
    using Address for address;
    using Clones for address;

    /**
     * @dev Ensures the staking functionality is not paused.
     * @custom:revert EStakePaused Check if staking is currently paused.
     */
    modifier stakeNotPaused() {
        if (isStakePaused) {
            revert EStakePaused();
        }
        _;
    }

    /**
     * @dev Initializes the `DepositManager` contract with required addresses and configurations.
     * @param initialOwner_ Address that will own the contract.
     * @param authorizedStaker_ Address authorized to perform staking operations.
     * @param guardian_ Address that can pause the contract.
     * @param supplyManager_ Supply Manager contract's address.
     * @param weth_ Wrapped ETH contract's address.
     * @param strategyFactory_ Strategy Factory contract's address.
     * @param delegationManager_ Delegation Manager contract's address.
     * @param rewardsCoordinator_ Reward Coordinator contract's address.
     * @param delegatorImplementation_ Delegator implementation contract's address.
     * @custom:revert Check if any of the addresses is zero.
     */
    constructor(
        address initialOwner_,
        address authorizedStaker_,
        address guardian_,
        address supplyManager_,
        address weth_,
        address strategyFactory_,
        address delegationManager_,
        address rewardsCoordinator_,
        address delegatorImplementation_
    )
        notZeroAddress(authorizedStaker_)
        notZeroAddress(supplyManager_)
        notZeroAddress(weth_)
        notZeroAddress(strategyFactory_)
        notZeroAddress(delegationManager_)
        notZeroAddress(rewardsCoordinator_)
        notZeroAddress(delegatorImplementation_)
        Ownable(initialOwner_)
        Guardian(guardian_)
    {
        authorizedStaker = authorizedStaker_;
        SUPPLY_MANAGER = supplyManager_;
        WETH = weth_;
        STRATEGY_FACTORY = IStrategyFactory(strategyFactory_);
        DELEGATION_MANAGER = IDelegationManager(delegationManager_);
        REWARDS_COORDINATOR = rewardsCoordinator_;
        delegatorImplementation = delegatorImplementation_;
    }

    /// @inheritdoc IDepositManager
    function initialize(
        address moleculaBuffer_,
        uint16 bufferPercent_,
        SetPoolData[] calldata setPoolData_
    ) external onlyOwner initializer checkBPS(bufferPercent_) {
        // Set the Molecula Buffer contract's address.
        _setMoleculaBuffer(moleculaBuffer_);

        // Set the initial buffer percentage.
        bufferPercentage = bufferPercent_;

        // Set initial Pools.
        _setPools(setPoolData_, setPoolData_.length);
    }

    // ============ STAKE FUNCTIONS ============

    /// @inheritdoc IMoleculaPoolV2
    function deposit(
        uint256,
        address token,
        address vault,
        uint256 value
    ) external only(SUPPLY_MANAGER) returns (uint256 moleculaTokenAssets) {
        // Transfer tokens from the Vault to this contract.
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(token).safeTransferFrom(vault, address(this), value);

        // Deposit WETH into the configured Pools.
        // Delegate deposited LRT tokens for the chosen operator.
        _restakeTokens(token, value);

        // Emit a request deposit event.
        emit Deposit(token, vault, value);

        return _convertTokenToETH(getStrategy(token), value);
    }

    /// @inheritdoc IMoleculaPoolV2WithNativeToken
    function depositNativeToken(
        uint256,
        address,
        address,
        uint256
    ) external payable only(SUPPLY_MANAGER) returns (uint256 moleculaTokenAssets) {
        // Convert ETH to WETH and deposit into the Pools.
        IWETH(WETH).deposit{value: msg.value}();

        _depositIntoPools(msg.value);

        return msg.value;
    }

    /// @dev Allows the contract to receive ETH.
    receive() external payable {}

    /// @inheritdoc IDepositManager
    function stakeNative(
        uint256 value,
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external only(authorizedStaker) {
        // Calculate the buffered supply.
        (uint256 bufferedTvl, uint256[] memory bufferedTvls) = totalBufferedSupply();

        // Revert if the value is greater than the buffered supply.
        if (value > bufferedTvl) {
            revert ETooHighDepositValue();
        }

        // If the buffer percentage is greater than 0, calculate the maximum value to deposit.
        if (bufferPercentage > 0) {
            unchecked {
                // Calculate the desired allocation to stay in the buffer.
                uint256 desiredAllocationToStayInBuffer = (totalSupply() * bufferPercentage) /
                    ConstantsCoreV2.PERCENTAGE_FACTOR;

                // Check if any value to stake is available.
                if (bufferedTvl < desiredAllocationToStayInBuffer) {
                    revert ENoNeedToStake();
                }

                // Calculate the maximum value to deposit.
                uint256 maxValueToDeposit = bufferedTvl - desiredAllocationToStayInBuffer;

                // Ensure that we can deposit the value.
                if (value > maxValueToDeposit) {
                    revert ETooHighDepositValue();
                }
            }
        }

        // Call to withdraw the value from the Pools.
        _withdrawFromPools(value, bufferedTvl, bufferedTvls);

        // Convert the WETH amount into ETH.
        IWETH(WETH).withdraw(value);

        // Choose an operator for stake delegation.
        address delegator = chooseDelegatorForDeposit();

        // Delegate the deposited ETH tokens for the chosen operator.
        IDelegator(delegator).stakeNative{value: value}(pubkey, signature, depositDataRoot);

        // Emit a deposit event.
        emit StakeNative(value, pubkey, signature, depositDataRoot);
    }

    /// @inheritdoc IDepositManager
    function verifyWithdrawalCredentials(
        address operator,
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external only(authorizedStaker) stakeNotPaused {
        address delegator = operatorsDelegators[operator].delegator;

        IDelegator(delegator).verifyWithdrawalCredentials(
            beaconTimestamp,
            stateRootProof,
            validatorIndices,
            validatorFieldsProofs,
            validatorFields
        );
    }

    // ============ UPDATE YIELD FUNCTIONS ============

    /// @inheritdoc IDepositManager
    function startCheckpoint(address operator) external only(authorizedStaker) {
        address delegator = operatorsDelegators[operator].delegator;

        // Claim rewards by the EigenLayer's delegator.
        IDelegator(delegator).startCheckpoint();
    }

    /// @inheritdoc IDepositManager
    function verifyCheckpointProofs(
        address operator,
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external only(authorizedStaker) {
        address delegator = operatorsDelegators[operator].delegator;

        // Claim rewards by the EigenLayer's delegator.
        IDelegator(delegator).verifyCheckpointProofs(balanceContainerProof, proofs);
    }

    /// @inheritdoc IDepositManager
    function claimRewards(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) public only(authorizedStaker) {
        address delegator = operatorsDelegators[operator].delegator;

        // Claim rewards by the EigenLayer's delegator.
        IDelegator(delegator).claimRewards(claim);
    }

    /// @inheritdoc IDepositManager
    function restakeRewards(
        address[] calldata tokens,
        uint256[] calldata values
    ) external only(authorizedStaker) {
        uint256 length = tokens.length;

        if (length != values.length) {
            revert EIncorrectLength();
        }

        for (uint256 i = 0; i < length; ++i) {
            _restakeTokens(tokens[i], values[i]);
        }
    }

    /// @inheritdoc IDepositManager
    function claimRewardsAndRestake(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external only(authorizedStaker) {
        // Claim rewards from EigenLayer.
        claimRewards(operator, claim);

        uint256 length = claim.tokenLeaves.length;

        // Process claimed rewards — restake them if the asset is supported as collateral.
        // Otherwise, forward to the reward destination.
        for (uint256 i = 0; i < length; ++i) {
            // Get the token and its balance.
            address token = address(claim.tokenLeaves[i].token);
            uint256 value = IERC20(token).balanceOf(address(this));

            // Deposit WETH rewards into the configured Pools.
            // Delegate LRT tokens rewards for the chosen operator.
            _restakeTokens(token, value);
        }
    }

    // ============ REDEEM AND REDELEGATE FUNCTIONS ============

    /// @inheritdoc IDepositManager
    function redelegate(
        address oldOperator,
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external only(authorizedStaker) stakeNotPaused {
        address delegator = operatorsDelegators[oldOperator].delegator;
        IDelegator(delegator).redelegate(newOperator, approverSignatureAndExpiry, approverSalt);
    }

    // TO:DO Add `requestRedeem` and `redeem`.

    /// @inheritdoc IMoleculaPoolV2WithNativeToken
    // solhint-disable-next-line no-empty-blocks
    function grantNativeToken(address receiver, uint256 nativeTokenAmount) external {}

    /// @inheritdoc IMoleculaPoolV2
    // solhint-disable-next-line no-empty-blocks
    function requestRedeem(uint256, address, uint256) external returns (uint256 values) {}

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IDepositManager
    function chooseDelegatorForDeposit() public view stakeNotPaused returns (address) {
        // Get the total restaked TVL and individual operator TVLs.
        (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs) = totalRestakedSupply();
        // Ensure the operator list is not empty.
        if (operatorsArray.length == 0) revert EOperatorNotExists();

        // For the single operator case, return its delegator directly.
        if (operatorsArray.length == 1) {
            return operatorsDelegators[operatorsArray[0]].delegator;
        }

        // Otherwise, find the operator delegator with the TVL below the threshold.
        uint256 tvlLength = operatorDelegatorTVLs.length;

        for (uint256 i = 0; i < tvlLength; ++i) {
            unchecked {
                // Calculate the target TVL for this operator based on their delegation portion.
                // If the current TVL is below the target, this operator is eligible for more deposits.
                if (
                    operatorDelegatorTVLs[i] <
                    (operatorsDelegators[operatorsArray[i]].delegationPortion * restakedTvl) /
                        ConstantsCoreV2.PERCENTAGE_FACTOR
                ) {
                    return operatorsDelegators[operatorsArray[i]].delegator;
                }
            }
        }

        // If all operators are at or above their target TVL, use the first operator.
        return operatorsDelegators[operatorsArray[0]].delegator;
    }

    /// @inheritdoc IDepositManager
    function getStrategy(address token) public view returns (IStrategy strategy) {
        if (address(strategies[token].strategy) == address(0)) {
            return STRATEGY_FACTORY.deployedStrategies(IERC20(token));
        }
        return strategies[token].strategy;
    }

    /// @inheritdoc IDepositManager
    function getWithdrawalCredentials(address delegator) external view returns (bytes memory) {
        return
            abi.encodePacked(
                bytes1(0x01),
                bytes11(0),
                DELEGATION_MANAGER.eigenPodManager().getPod(delegator)
            );
    }

    /// @inheritdoc IDepositManager
    function totalSupply() public view returns (uint256) {
        (uint256 bufferedTvl, ) = totalBufferedSupply();
        (uint256 restakedTvl, ) = totalRestakedSupply();

        return bufferedTvl + restakedTvl;
    }

    /// @inheritdoc IMoleculaPoolV2
    function validatedTotalSupply() external view virtual override returns (uint256 pool) {
        pool = totalSupply();
    }

    /**
     * @dev Calculates the total buffered supply including the yield from LP tokens.
     * @return bufferedTvl Total ETH supply in the buffer.
     * @return bufferedTvls Array of ETH supply in each Pool.
     */
    function totalBufferedSupply()
        public
        view
        returns (uint256 bufferedTvl, uint256[] memory bufferedTvls)
    {
        uint256 length = poolsArray.length;
        bufferedTvls = new uint256[](length);

        // Gets all withdrawable tokens from LP.
        for (uint256 i = 0; i < length; ++i) {
            address pool = poolsArray[i];
            PoolData memory _poolData = poolData[pool];

            uint256 poolTvl = IBufferInteractor(_poolData.poolLib).getEthBalance(
                pool,
                _poolData.poolToken,
                address(this)
            );

            // Add the Pool TVL to the total buffered TVL and store it in the array.
            bufferedTvl += poolTvl;
            bufferedTvls[i] = poolTvl;
        }

        bufferedTvl += IERC20(WETH).balanceOf(moleculaBuffer);
    }

    /// @inheritdoc IDepositManager
    function totalRestakedSupply()
        public
        view
        virtual
        returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs)
    {
        // Get the strategy manager contract.
        IStrategyManager strategyManager = DELEGATION_MANAGER.strategyManager();

        // Initialize an array to store the TVL for each operator.
        uint256 operatorsLength = operatorsArray.length;
        operatorDelegatorTVLs = new uint256[](operatorsLength);

        for (uint256 i = 0; i < operatorsLength; ++i) {
            address delegator = operatorsDelegators[operatorsArray[i]].delegator;

            // Gets all deposited strategies.
            // slither-disable-next-line unused-return
            (IStrategy[] memory _strategies, ) = strategyManager.getDeposits(delegator);

            // Length of the `strategies` array.
            uint256 strategiesLength = _strategies.length;

            // TVL in ETH delegated to the chosen operator.
            uint256 operatorEthBalance = 0;

            // Get all withdrawable tokens' amount from the EigenLayer's operator converted to ETH.
            for (uint256 j = 0; j < strategiesLength; ++j) {
                uint256 stakedAmount = _strategies[j].userUnderlyingView(delegator);
                operatorEthBalance += _convertTokenToETH(_strategies[j], stakedAmount);
            }

            // Get the value of the native ETH staked.
            IEigenPodManager eigenPodManager = DELEGATION_MANAGER.eigenPodManager();

            // Get withdrawable amount of restaked ETH.
            int256 podOwnerShares = eigenPodManager.podOwnerDepositShares(delegator);
            uint256 pendingNativeSupply = IDelegator(delegator).totalPendingNativeSupply();

            // Handle the case of negative pod owner shares.
            if (podOwnerShares < 0) {
                // If the pending supply is greater than negative shares, add the difference.
                if (pendingNativeSupply > uint256(-podOwnerShares)) {
                    unchecked {
                        operatorEthBalance += pendingNativeSupply - uint256(-podOwnerShares);
                    }
                }
            } else {
                // For positive shares, add both the pending supply and shares.
                operatorEthBalance += pendingNativeSupply + uint256(podOwnerShares);
            }

            // Add this operator's TVL to total and store it in the array.
            restakedTvl += operatorEthBalance;
            operatorDelegatorTVLs[i] = operatorEthBalance;
        }
    }

    /**
     * @dev Converter token balance into ETH.
     * @param value Amount of tokens to convert.
     * @param strategy Strategy contract's address.
     * @return convertedValueToETH Amount of ETH converted from the token value.
     */
    function _convertTokenToETH(IStrategy strategy, uint256 value) internal view returns (uint256) {
        IStrategyLib strategyLib = strategies[address(strategy)].strategyLib;

        return address(strategyLib) != address(0) ? strategyLib.getEthBalance(value) : value;
    }

    /**
     * @dev Validates that a token Vault is properly configured for the system.
     * @param tokenVault Address of the token vault to validate.
     */
    function _validateTokenVault(address tokenVault) internal view only(SUPPLY_MANAGER) {
        address token = IERC7575(tokenVault).asset();

        //TO:DO Add checks for the restaked zero balance or removes restaked balance for the deleted token.
        // Validate that a strategy exists for the token Vault's value.
        // Skip the check for WETH and ETH, as they have a different flow than LRT.
        if (
            address(getStrategy(token)) == address(0) &&
            token != WETH &&
            token != ConstantsCoreV2.NATIVE_TOKEN
        ) {
            revert EStrategyNotExists();
        }
    }

    /// @inheritdoc IDepositManager
    function getAvailableAmountToDeposit()
        public
        view
        returns (uint256[] memory availableAmounts, uint256 totalAvailableAmount)
    {
        uint256 length = poolsArray.length;

        availableAmounts = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
            address pool = poolsArray[i];
            PoolData memory _poolData = poolData[pool];

            // Get the available amount to deposit for each Pool.
            uint256 availableAmount = IBufferInteractor(_poolData.poolLib)
                .getAvailableAmountToDeposit(pool, WETH, _poolData.poolToken);

            // Increment `availableAmounts` for each Pool.
            availableAmounts[i] = availableAmount;

            // Increment `totalAvailableAmount` for each Pool. If it's reached the maximum value, set it to the maximum value.
            if (availableAmount == type(uint256).max || totalAvailableAmount == type(uint256).max) {
                totalAvailableAmount = type(uint256).max;
            } else {
                totalAvailableAmount += availableAmount;
            }
        }
    }

    // ============ SETTERS FUNCTIONS ============

    /// @inheritdoc IDepositManager
    function addOperator(
        address operator,
        bytes32 salt,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external notZeroAddress(operator) {
        // Check if the operator is already added.
        if (operatorsDelegators[operator].delegationPortion > 0) {
            revert EOperatorExists();
        }

        address predictedAddress = delegatorImplementation.predictDeterministicAddress(salt);

        // Check if the contract is already deployed at the expected address.
        if (predictedAddress.code.length != 0) {
            revert EContractAlreadyExists();
        }

        // Deploy the minimal proxy clone for the `delegatorImplementation` contract.
        address cloneAddress = delegatorImplementation.cloneDeterministic(salt);

        // Check if the contract is deployed at the expected address.
        if (predictedAddress != cloneAddress) {
            revert EIncorrectPredictedAddress();
        }

        // Store operator and delegator.
        operatorsDelegators[operator].delegator = cloneAddress;
        operatorsArray.push(operator);

        // Set the delegation portions for each operator in the system.
        setOperatorsPortions(newOperatorsArray, newDelegationPortions);

        // Initialize a clone.
        IDelegator(cloneAddress).initialize(
            DELEGATION_MANAGER,
            REWARDS_COORDINATOR,
            operator,
            approverSignatureAndExpiry,
            approverSalt
        );

        emit OperatorAdded(operator, cloneAddress);
    }

    /// @inheritdoc IDepositManager
    function removeOperator(
        address operator,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external {
        address delegator = operatorsDelegators[operator].delegator;

        // Ensure the delegator has no active stake before removal.
        if (DELEGATION_MANAGER.delegatedTo(delegator) != address(0)) {
            revert EDelegatorHasActiveStake();
        }

        // Get the current number of operators.
        uint256 length = operatorsArray.length;

        // Find and remove the operator from the array.
        for (uint256 i = 0; i < length; ++i) {
            if (operatorsArray[i] == operator) {
                operatorsDelegators[operator].delegationPortion = 0;
                operatorsArray[i] = operatorsArray[length - 1];
                // slither-disable-next-line costly-loop
                operatorsArray.pop();
            }
        }

        // Update the delegation portions for the remaining operators.
        setOperatorsPortions(newOperatorsArray, newDelegationPortions);

        emit OperatorRemoved(operator);
    }

    /// @inheritdoc IDepositManager
    function setOperatorsPortions(
        address[] calldata newOperatorsArray,
        uint64[] calldata delegationPortions
    ) public onlyOwner {
        uint256 length = operatorsArray.length;

        if (delegationPortions.length != length || newOperatorsArray.length != length) {
            revert EIncorrectLength();
        }

        uint256 portionsSum = 0;

        for (uint256 i = 0; i < length; ++i) {
            portionsSum += delegationPortions[i];
            operatorsArray[i] = newOperatorsArray[i];
            operatorsDelegators[newOperatorsArray[i]].delegationPortion = delegationPortions[i];
        }

        // `portionsSum` must be equal to 100%.
        if (portionsSum != ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EWrongPortion();
        }

        emit OperatorsPortionsChanged(newOperatorsArray, delegationPortions);
    }

    /// @inheritdoc IDepositManager
    function addStrategies(
        address[] calldata tokens,
        IStrategy[] calldata newStrategies,
        IStrategyLib[] calldata strategyLibraries
    ) external {
        uint256 length = tokens.length;

        if (length != newStrategies.length) {
            revert EIncorrectLength();
        }

        for (uint256 i = 0; i < length; ++i) {
            // Set the strategy data.
            addStrategy(tokens[i], newStrategies[i], strategyLibraries[i]);
        }
    }

    /// @inheritdoc IDepositManager
    function addStrategy(
        address token,
        IStrategy newStrategy,
        IStrategyLib strategyLibrary
    ) public onlyOwner notZeroAddress(token) {
        // Set the strategy data for interacting with EigenLayer and converting balance of token into ETH.
        strategies[token] = StrategyData(newStrategy, strategyLibrary);

        // Get stored strategy for validation.
        IStrategy strategy = getStrategy(token);

        // Get the strategy manager contract.
        IStrategyManager strategyManager = DELEGATION_MANAGER.strategyManager();

        // Validate that the strategy's underlying token matches the Vault's token
        // and that the strategy is whitelisted for deposits.

        if (address(strategy.underlyingToken()) != token) {
            revert EInvalidStrategyConfiguration("Underlying token mismatch");
        }

        if (!strategyManager.strategyIsWhitelistedForDeposit(strategy)) {
            revert EInvalidStrategyConfiguration("Strategy not whitelisted");
        }

        emit StrategyAdded(token, newStrategy, strategyLibrary);
    }

    /// @inheritdoc IDepositManager
    function setPools(
        SetPoolData[] calldata setPoolData,
        uint256 expectedPoolLength
    ) external onlyOwner {
        (PoolData[] memory filteredPoolsData, uint256 balanceEthToRebalance) = _setPools(
            setPoolData,
            expectedPoolLength
        );
        _rebalanceBuffer(filteredPoolsData, balanceEthToRebalance);
    }

    /**
     * @dev Sets configuration for a single Pool.
     * @param setPoolData SetPoolData struct.
     * @return balanceEthToRebalance Amount of ETH to rebalance.
     */
    function _setPool(
        SetPoolData memory setPoolData
    ) internal returns (uint256 balanceEthToRebalance) {
        if (setPoolData.auth) {
            if (poolData[setPoolData.pool].poolPortion == 0) {
                poolsArray.push(setPoolData.pool);

                // Approve WETH to the Pool.
                IERC20(WETH).forceApprove(setPoolData.pool, type(uint256).max);
            }

            poolData[setPoolData.pool] = setPoolData.newPoolData;
        } else {
            PoolData memory _poolData = poolData[setPoolData.pool];
            poolsArray[_poolData.poolId] = poolsArray[poolsArray.length - 1];

            // Revoke the WETH approval from the Pool.
            IERC20(WETH).forceApprove(setPoolData.pool, 0);

            poolsArray.pop();

            // Get the Pool's balance.
            balanceEthToRebalance = IBufferInteractor(_poolData.poolLib).getEthBalance(
                setPoolData.pool,
                _poolData.poolToken,
                address(this)
            );

            // Withdraws the deleted Pool's balance.
            if (balanceEthToRebalance > 0) {
                _executeWithdraw(setPoolData.pool, _poolData.poolLib, balanceEthToRebalance);
            }

            delete poolData[setPoolData.pool];
        }

        emit PoolSet(setPoolData);
    }

    /**
     * @dev Authorizes new Pools.
     * @param setPoolData Array of `SetPoolData` structs.
     * @param expectedPoolLength Expected length of `poolsArray` after adding and removing Pools.
     * @return filteredPoolsData Array of Pools' data after filtering by auth true.
     * @return balanceEthToRebalance Total amount of ETH withdrawn from the LPs.
     */
    function _setPools(
        SetPoolData[] memory setPoolData,
        uint256 expectedPoolLength
    ) internal returns (PoolData[] memory filteredPoolsData, uint256 balanceEthToRebalance) {
        uint256 length = setPoolData.length;

        // `ExpectedPoolLength` could not be greater than the length of the setPoolData, given the removed Pools.
        if (expectedPoolLength > length) {
            revert EIncorrectLength();
        }

        filteredPoolsData = new PoolData[](expectedPoolLength);

        uint256 portionsSum = 0;
        uint256 j = 0;

        for (uint256 i = 0; i < length; ++i) {
            SetPoolData memory _setPoolData = setPoolData[i];
            balanceEthToRebalance += _setPool(_setPoolData);

            if (_setPoolData.auth) {
                filteredPoolsData[j] = _setPoolData.newPoolData;
                portionsSum += _setPoolData.newPoolData.poolPortion;

                if (_setPoolData.pool != poolsArray[_setPoolData.newPoolData.poolId]) {
                    revert EWrongPoolId();
                }
                unchecked {
                    ++j;
                }
            }
        }

        // `portionsSum` must be equal to 100%.
        if (portionsSum != ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EWrongPortion();
        }

        // Check if the `poolsArray` length is equal to `expectedPoolLength`.
        if (poolsArray.length != expectedPoolLength) {
            revert EIncorrectExpectedPoolLength();
        }
    }

    /// @inheritdoc IMoleculaPoolV2
    function addTokenVault(address tokenVault) external view {
        _validateTokenVault(tokenVault);
    }

    /// @inheritdoc IMoleculaPoolV2
    function removeTokenVault(address tokenVault) external view {
        _validateTokenVault(tokenVault);
    }

    /// @inheritdoc IDepositManager
    function setBufferPercentage(
        uint16 newBufferPercentage
    ) external checkBPS(newBufferPercentage) onlyOwner {
        bufferPercentage = newBufferPercentage;

        emit BufferPercentageChanged(newBufferPercentage);
    }

    /// @inheritdoc IDepositManager
    function setMoleculaBuffer(address newMoleculaBuffer) external onlyOwner {
        _setMoleculaBuffer(newMoleculaBuffer);
    }

    /**
     * @dev Sets the Molecula Buffer contract's address.
     * @param newMoleculaBuffer New Molecula Buffer contract's address.
     */
    function _setMoleculaBuffer(
        address newMoleculaBuffer
    ) internal notZeroAddress(newMoleculaBuffer) {
        // If the new Molecula Buffer has balance, revoke the approval from the old Molecula Buffer.
        if (moleculaBuffer != address(0)) {
            if (IERC20(WETH).balanceOf(moleculaBuffer) != 0) {
                revert EMoleculaBufferHasBalance();
            }

            // Revoke the WETH approval from the Molecula Buffer.
            IERC20(WETH).forceApprove(moleculaBuffer, 0);
        }

        moleculaBuffer = newMoleculaBuffer;

        // Approve WETH to the Molecula Buffer.
        IERC20(WETH).forceApprove(moleculaBuffer, type(uint256).max);
        emit MoleculaBufferChanged(newMoleculaBuffer);
    }

    /// @inheritdoc IDepositManager
    function setDelegatorImplementation(
        address newDelegatorImplementation
    ) external onlyOwner notZeroAddress(newDelegatorImplementation) {
        delegatorImplementation = newDelegatorImplementation;

        emit DelegatorImplementationChanged(newDelegatorImplementation);
    }

    /// @inheritdoc IDepositManager
    function setAuthorizedStaker(
        address newAuthorizedStaker
    ) external onlyOwner notZeroAddress(newAuthorizedStaker) {
        authorizedStaker = newAuthorizedStaker;

        emit AuthorizedStakerChanged(newAuthorizedStaker);
    }

    /// @dev Set a new value for the `isRedeemPaused` flag.
    /// @param newValue New value.
    function _setStakePaused(bool newValue) private {
        if (isStakePaused == newValue) {
            revert EPauseAlreadySet();
        }
        isStakePaused = newValue;
        emit IsStakePausedChanged(newValue);
    }

    /// @inheritdoc IDepositManager
    function pauseStake() external onlyAuthForPause {
        _setStakePaused(true);
    }

    /// @inheritdoc IDepositManager
    function unpauseStake() external onlyOwner {
        _setStakePaused(false);
    }

    /// @inheritdoc Ownable2Step
    function _transferOwnership(address newOwner) internal virtual override(Ownable, Ownable2Step) {
        // Transfer ownership to the new owner.
        super._transferOwnership(newOwner);
    }

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, Ownable2Step) {
        // Initiate ownership transfer.
        super.transferOwnership(newOwner);
    }

    // ============ BUFFER DEPOSIT, WITHDRAW AND RESTAKE FUNCTIONS ============

    /// @inheritdoc IDepositManager
    function rebalanceBuffer(PoolData[] calldata newPoolsData) external onlyOwner {
        _rebalanceBuffer(newPoolsData, 0);
    }

    /**
     * @dev Rebalances the buffer with new Pool configurations and extra value.
     * @param newPoolsData Array of new Pool configurations.
     * @param extraValue Additional value to consider in rebalancing.
     */
    function _rebalanceBuffer(PoolData[] memory newPoolsData, uint256 extraValue) internal {
        // Length of a new `poolsArray`.
        uint256 length = poolsArray.length;

        // Calculate the buffer TVL.
        uint256 bufferTvl = extraValue + totalSupply();

        // Create arrays for the rebalance calculation.
        uint256[] memory expectedPoolsBalances = new uint256[](length);
        uint256[] memory actualPoolsBalances = new uint256[](length);

        for (uint256 i = 0; i < length; ++i) {
            address pool = poolsArray[i];

            // Rewrite the new `poolData`.
            poolData[pool] = newPoolsData[i];

            unchecked {
                // Calculate the amount to deposit to the Pool by distribution deposit portions.
                expectedPoolsBalances[i] =
                    (bufferTvl * newPoolsData[i].poolPortion) /
                    ConstantsCoreV2.PERCENTAGE_FACTOR;
            }

            actualPoolsBalances[i] = IBufferInteractor(newPoolsData[i].poolLib).getEthBalance(
                pool,
                newPoolsData[i].poolToken,
                address(this)
            );

            // Withdraw extra balance of the Pool.
            if (actualPoolsBalances[i] > expectedPoolsBalances[i]) {
                _executeWithdraw(
                    pool,
                    newPoolsData[i].poolLib,
                    actualPoolsBalances[i] - expectedPoolsBalances[i]
                );
            }
        }

        // Deposit into Pools after withdrawing all extra balances.
        for (uint256 i = 0; i < length; ++i) {
            if (expectedPoolsBalances[i] > actualPoolsBalances[i]) {
                _executeDeposit(
                    poolsArray[i],
                    poolData[poolsArray[i]].poolLib,
                    expectedPoolsBalances[i] - actualPoolsBalances[i]
                );
            }
        }
    }

    /**
     * @dev Deposits funds into Pools according to their portions.
     * @param value Total amount to deposit.
     */
    function _depositIntoPools(uint256 value) internal {
        uint256 length = poolsArray.length;

        // Track the remaining value to deposit.
        uint256 remainingValue = value;

        // Get the available amounts to deposit for each Pool.
        (uint256[] memory availableAmounts, ) = getAvailableAmountToDeposit();

        // If only one Pool exists, deposit all the value without calculations.
        if (length == 1) {
            uint256 depositAmount = value < availableAmounts[0] ? value : availableAmounts[0];
            remainingValue -= depositAmount;
            _executeDeposit(poolsArray[0], poolData[poolsArray[0]].poolLib, depositAmount);
        } else {
            (uint256 bufferTvl, ) = totalBufferedSupply();

            // Iterate through Pools and deposit based on the TVL requirements.
            for (uint256 i = 0; i < length && remainingValue > 0; ++i) {
                PoolData memory _poolData = poolData[poolsArray[i]];

                if (_poolData.poolPortion > 0) {
                    // Get the Pool TVL for portion limits calculation.
                    uint256 poolTvl = IBufferInteractor(_poolData.poolLib).getEthBalance(
                        poolsArray[i],
                        _poolData.poolToken,
                        address(this)
                    );

                    unchecked {
                        // Calculate the required TVL based on the Pool portion.
                        uint256 requiredTvl = ((bufferTvl + value) * _poolData.poolPortion) /
                            ConstantsCoreV2.PERCENTAGE_FACTOR;

                        // Check if the Pool needs more TVL to satisfy its portion.
                        if (poolTvl < requiredTvl) {
                            // Calculate how much we can deposit to this Pool.
                            uint256 maxDepositToPool = availableAmounts[i];
                            uint256 depositAmount = remainingValue < maxDepositToPool
                                ? remainingValue
                                : maxDepositToPool;

                            remainingValue -= depositAmount;
                            _executeDeposit(poolsArray[i], _poolData.poolLib, depositAmount);
                        }
                    }
                }
            }
        }

        // If `remainingValue` is greater than 0, deposit it into the Molecula buffer.
        _executeDeposit(moleculaBuffer, moleculaBuffer, remainingValue);
    }

    /**
     * @dev Withdraws funds from the Pools according to their portions.
     * @param value Total amount to withdraw.
     * @param bufferedTvl Total ETH supply in the buffer.
     * @param bufferedTvls Array of ETH supply in each pool.
     */
    function _withdrawFromPools(
        uint256 value,
        uint256 bufferedTvl,
        uint256[] memory bufferedTvls
    ) internal {
        uint256 length = poolsArray.length;

        // Track the remaining value to withdraw.
        uint256 remainingValue = value;

        // First, withdraw from `MoleculaBuffer` if it has funds.
        uint256 moleculaBufferBalance = IBufferInteractor(moleculaBuffer).getEthBalance(
            moleculaBuffer,
            WETH,
            address(this)
        );

        // If `MoleculaBuffer` has funds, withdraw from it.
        if (moleculaBufferBalance > 0) {
            unchecked {
                uint256 withdrawAmountFromBuffer = remainingValue < moleculaBufferBalance
                    ? remainingValue
                    : moleculaBufferBalance;
                if (withdrawAmountFromBuffer > 0) {
                    _executeWithdraw(moleculaBuffer, moleculaBuffer, withdrawAmountFromBuffer);
                    remainingValue -= withdrawAmountFromBuffer;
                }
            }
        }

        // If the remaining value to withdraw is 0, return the function.
        // slither-disable-next-line incorrect-equality
        if (remainingValue == 0) {
            return;
        }

        // If only one Pool exists, withdraw all the remaining value without calculation.
        if (length == 1) {
            return _executeWithdraw(poolsArray[0], poolData[poolsArray[0]].poolLib, remainingValue);
        }

        // If we still need to withdraw more, withdraw from Pools to align closer to the target proportions.
        // Withdraw from Pools to align closer to the target proportions.
        for (uint256 i = 0; i < length && remainingValue > 0; ++i) {
            PoolData memory _poolData = poolData[poolsArray[i]];
            if (_poolData.poolPortion > 0 && bufferedTvls[i] > 0) {
                unchecked {
                    // Calculate the target TVL for this Pool based on its portion.
                    uint256 targetTvl = ((bufferedTvl - value) * _poolData.poolPortion) /
                        ConstantsCoreV2.PERCENTAGE_FACTOR;

                    // Calculate how much we can withdraw from this Pool.
                    uint256 currentTvl = bufferedTvls[i];
                    uint256 maxWithdrawFromPool = currentTvl > targetTvl
                        ? currentTvl - targetTvl
                        : 0;

                    if (maxWithdrawFromPool > 0) {
                        uint256 withdrawAmount = remainingValue < maxWithdrawFromPool
                            ? remainingValue
                            : maxWithdrawFromPool;

                        if (withdrawAmount > 0) {
                            _executeWithdraw(poolsArray[i], _poolData.poolLib, withdrawAmount);
                            remainingValue -= withdrawAmount;
                        }
                    }
                }
            }
        }
    }

    /**
     * @dev Deposits into a Pool.
     * @param pool Address of the Pool.
     * @param poolLib Address of the Pool library.
     * @param value Amount to deposit.
     */
    function _executeDeposit(address pool, address poolLib, uint256 value) internal {
        if (value > 0) {
            // Get `calldata` for deposit into the Pool.
            bytes memory data = IBufferInteractor(poolLib).encodeSupply(WETH, address(this), value);

            // slither-disable-next-line unused-return
            pool.functionCall(data);
        }
    }

    /**
     * @dev Withdraws from a Pool.
     * @param pool Pool's address.
     * @param poolLib Pool library's address.
     * @param value Amount to withdraw.
     */
    function _executeWithdraw(address pool, address poolLib, uint256 value) internal {
        // Get `calldata` for withdrawal from the Pool.
        bytes memory data = IBufferInteractor(poolLib).encodeWithdraw(WETH, address(this), value);
        // slither-disable-next-line unused-return
        pool.functionCall(data);
    }

    /**
     * @dev Restakes tokens into the configured Pools.
     * @param token Token to restake.
     * @param value Token amount to restake.
     */
    function _restakeTokens(address token, uint256 value) internal {
        if (token == WETH) {
            // Deposit WETH into the configured Pools.
            _depositIntoPools(value);
        } else if (address(getStrategy(token)) != address(0)) {
            // For non-WETH tokens, delegate to an operator.
            address delegator = chooseDelegatorForDeposit();
            IERC20(token).forceApprove(delegator, value);

            // Delegate deposited LRT tokens for the chosen operator.
            IDelegator(delegator).stakeToken(getStrategy(token), IERC20(token), value);
        }
    }
}
