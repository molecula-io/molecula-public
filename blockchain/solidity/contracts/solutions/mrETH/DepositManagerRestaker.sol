// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {DepositManagerBase} from "./DepositManagerBase.sol";
import {DepositManagerStorage, IDelegationManager} from "./DepositManagerStorage.sol";
import {IRewardsCoordinatorTypes} from "./external/interfaces/IRewardsCoordinator.sol";
import {IStrategy, IStrategyManager} from "./external/interfaces/IStrategyManager.sol";
import {IWETH} from "./external/interfaces/IWETH.sol";
import {BeaconChainProofs} from "./external/libraries/BeaconChainProofs.sol";
import {IBufferInteractor} from "./interfaces/IBufferInteractor.sol";
import {IDelegator} from "./interfaces/IDelegator.sol";
import {IDepositManagerGetters} from "./interfaces/IDepositManagerGetters.sol";
import {IDepositManagerLib} from "./interfaces/IDepositManagerLib.sol";
import {IDepositManagerRestaker} from "./interfaces/IDepositManagerRestaker.sol";

/**
 * @title Deposit Manager.
 * @notice Manages deposits, withdrawals, and Pool operations for the mrETH protocol.
 * @dev This contract handles:
 * - Deposit and withdrawal of ETH, WETH, and other tokens.
 * - Pool management and rebalancing.
 * - Operator delegation and staking.
 * - Buffer management for maintaining liquidity.
 */
contract DepositManagerRestaker is
    DepositManagerStorage,
    IDepositManagerRestaker,
    DepositManagerBase,
    ValueValidator,
    AccessControl
{
    using SafeERC20 for IERC20;
    using Clones for address;

    // ============ STAKE FUNCTIONS ============

    /// @inheritdoc IDepositManagerRestaker
    function stakeNative(
        uint256 value,
        bytes calldata pubkey,
        bytes calldata signature,
        bytes32 depositDataRoot
    ) external {
        // Calculate the buffered supply.
        (uint256 bufferedTvl, uint256[] memory bufferedTvls) = IDepositManagerLib(
            config.depositManagerLib
        ).getTotalBufferedSupply(address(this));

        // Revert if the value is greater than the buffered supply.
        if (value > bufferedTvl) {
            revert ETooHighDepositValue();
        }

        // If the buffer percentage is greater than 0, calculate the maximum value to deposit.
        if (config.bufferPercentage > 0) {
            unchecked {
                // Calculate the desired allocation to stay in the Buffer.
                uint256 desiredAllocationToStayInBuffer = (IDepositManagerLib(
                    config.depositManagerLib
                ).totalSupply(address(this)) * config.bufferPercentage) /
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
        IWETH(wETH()).withdraw(value);

        // Choose an operator for stake delegation.
        address delegator = chooseDelegatorForDeposit();

        // Delegate the deposited ETH tokens for the chosen operator.
        IDelegator(delegator).stakeNative{value: value}(pubkey, signature, depositDataRoot);

        // Emit a deposit event.
        emit StakeNative(value, pubkey, signature, depositDataRoot);
    }

    /// @inheritdoc IDepositManagerRestaker
    function verifyWithdrawalCredentials(
        address operator,
        uint64 beaconTimestamp,
        BeaconChainProofs.StateRootProof calldata stateRootProof,
        uint40[] calldata validatorIndices,
        bytes[] calldata validatorFieldsProofs,
        bytes32[][] calldata validatorFields
    ) external {
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

    /// @inheritdoc IDepositManagerRestaker
    function startCheckpoint(address operator) external {
        address delegator = operatorsDelegators[operator].delegator;

        // Claim rewards by the EigenLayer's Delegator.
        IDelegator(delegator).startCheckpoint();
    }

    /// @inheritdoc IDepositManagerRestaker
    function verifyCheckpointProofs(
        address operator,
        BeaconChainProofs.BalanceContainerProof calldata balanceContainerProof,
        BeaconChainProofs.BalanceProof[] calldata proofs
    ) external {
        address delegator = operatorsDelegators[operator].delegator;

        // Claim rewards by the EigenLayer's Delegator.
        IDelegator(delegator).verifyCheckpointProofs(balanceContainerProof, proofs);
    }

    /// @inheritdoc IDepositManagerRestaker
    function claimRewards(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) public {
        address delegator = operatorsDelegators[operator].delegator;
        // Claim rewards by the EigenLayer's Delegator.
        IDelegator(delegator).claimRewards(claim);
    }

    /// @inheritdoc IDepositManagerRestaker
    function restakeRewards(address[] calldata tokens, uint256[] calldata values) external {
        uint256 length = tokens.length;
        if (length != values.length) {
            revert EIncorrectLength();
        }
        for (uint256 i = 0; i < length; ++i) {
            _restakeTokens(tokens[i], values[i]);
        }
    }

    /// @inheritdoc IDepositManagerRestaker
    function claimRewardsAndRestake(
        address operator,
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim
    ) external {
        // Claim rewards from EigenLayer.
        claimRewards(operator, claim);
        uint256 length = claim.tokenLeaves.length;

        // Process the claimed rewards — restake them if the asset is supported as collateral.
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

    // ============ REDELEGATE FUNCTIONS ============

    /// @inheritdoc IDepositManagerRestaker
    function redelegate(
        address oldOperator,
        address newOperator,
        IDelegationManager.SignatureWithExpiry calldata approverSignatureAndExpiry,
        bytes32 approverSalt
    ) external {
        address delegator = operatorsDelegators[oldOperator].delegator;
        IDelegator(delegator).redelegate(newOperator, approverSignatureAndExpiry, approverSalt);
    }

    // ============ VIEW FUNCTIONS ============

    /// @inheritdoc IDepositManagerRestaker
    function getStrategy(address token) public view returns (IStrategy strategy) {
        return
            IStrategy(
                IDepositManagerLib(config.depositManagerLib).getStrategy(token, address(this))
            );
    }

    /// @inheritdoc IDepositManagerRestaker
    function chooseDelegatorForDeposit() public view returns (address delegator) {
        // Get the total restaked TVL and individual operator TVLs.
        (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs) = IDepositManagerLib(
            config.depositManagerLib
        ).getTotalRestakedSupply(address(this));

        return
            IDepositManagerLib(config.depositManagerLib).chooseDelegatorForDeposit(
                restakedTvl,
                operatorDelegatorTVLs,
                address(this)
            );
    }

    /// @inheritdoc IDepositManagerRestaker
    function wETH() public view returns (address) {
        return IDepositManagerGetters(address(this)).WETH();
    }

    /**
     * @dev Withdraws funds from the Pools according to their portions.
     * @param value Total amount to withdraw.
     * @param bufferedTvl Total ETH supply in the Buffer.
     * @param bufferedTvls Array of ETH supply in each Pool.
     */
    function _withdrawFromPools(
        uint256 value,
        uint256 bufferedTvl,
        uint256[] memory bufferedTvls
    ) internal {
        // Get the WETH address.
        address _wETH = wETH();

        uint256 length = _poolsArray.length;
        // Track the remaining value to withdraw.
        uint256 remainingValue = value;
        // First, withdraw from `MoleculaBuffer` if it has funds.
        uint256 moleculaBufferBalance = IBufferInteractor(config.moleculaBuffer).getEthBalance(
            config.moleculaBuffer,
            _wETH,
            address(this)
        );
        // If `MoleculaBuffer` has funds, withdraw them.
        if (moleculaBufferBalance > 0) {
            unchecked {
                uint256 withdrawAmountFromBuffer = remainingValue < moleculaBufferBalance
                    ? remainingValue
                    : moleculaBufferBalance;
                if (withdrawAmountFromBuffer > 0) {
                    _executeWithdraw(
                        _wETH,
                        config.moleculaBuffer,
                        config.moleculaBuffer,
                        withdrawAmountFromBuffer
                    );
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
            return
                _executeWithdraw(
                    _wETH,
                    _poolsArray[0],
                    poolData[_poolsArray[0]].poolLib,
                    remainingValue
                );
        }
        // If we still need to withdraw more, withdraw from Pools to align closer to the target proportions.
        // Use the library to calculate withdrawal amounts.
        (uint256[] memory withdrawalAmounts, uint256 remainingValueAfterCalc) = IDepositManagerLib(
            config.depositManagerLib
        ).calculateWithdrawalAmounts(remainingValue, bufferedTvl, bufferedTvls, address(this));
        // Execute withdrawals based on the calculated amounts.
        for (uint256 i = 0; i < length; ++i) {
            if (withdrawalAmounts[i] > 0) {
                address pool = _poolsArray[i];
                _executeWithdraw(_wETH, pool, poolData[pool].poolLib, withdrawalAmounts[i]);
            }
        }
        remainingValue = remainingValueAfterCalc;
    }

    /**
     * @dev Restakes tokens into the configured Pools.
     * @param token Token to restake.
     * @param value Token amount to restake.
     */
    function _restakeTokens(address token, uint256 value) internal {
        if (token == wETH()) {
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

    /**
     * @dev Deposits funds into Pools according to their portions.
     * @param value Total amount to deposit.
     */
    function _depositIntoPools(uint256 value) internal {
        uint256 length = _poolsArray.length;

        // Get the available amounts to deposit for each Pool.
        // slither-disable-next-line unused-return
        (uint256[] memory availableAmounts, ) = IDepositManagerLib(config.depositManagerLib)
            .getAvailableAmountToDeposit(address(this));

        // Calculate the deposit amounts for each Pool.
        (uint256[] memory depositAmounts, uint256 remainingValue) = IDepositManagerLib(
            config.depositManagerLib
        ).calculateDepositAmounts(value, availableAmounts, address(this));

        // Get the WETH address.
        address _wETH = wETH();

        // Execute deposits based on the calculated amounts.
        for (uint256 i = 0; i < length; ++i) {
            if (depositAmounts[i] > 0) {
                address pool = _poolsArray[i];
                _executeDeposit(_wETH, pool, poolData[pool].poolLib, depositAmounts[i]);
            }
        }

        // Deposit remaining value into the Molecula Buffer.
        if (remainingValue > 0) {
            _executeDeposit(_wETH, config.moleculaBuffer, config.moleculaBuffer, remainingValue);
        }
    }

    // ============ SETTERS FUNCTIONS ============

    /// @inheritdoc IDepositManagerRestaker
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

        address predictedAddress = config.delegatorImplementation.predictDeterministicAddress(salt);

        // Check if the contract is already deployed at the expected address.
        if (predictedAddress.code.length != 0) {
            revert EContractAlreadyExists();
        }

        // Deploy the minimal proxy clone for the `delegatorImplementation` contract.
        address cloneAddress = config.delegatorImplementation.cloneDeterministic(salt);

        // Check if the contract is deployed at the expected address.
        if (predictedAddress != cloneAddress) {
            revert EIncorrectPredictedAddress();
        }

        // Store operator and delegator.
        operatorsDelegators[operator].delegator = cloneAddress;
        _operatorsArray.push(operator);

        // Set the delegation portions for each operator in the system.
        setOperatorsPortions(newOperatorsArray, newDelegationPortions);

        // Initialize a clone.
        IDelegator(cloneAddress).initialize(
            IDepositManagerGetters(address(this)).DELEGATION_MANAGER(),
            IDepositManagerGetters(address(this)).REWARDS_COORDINATOR(),
            operator,
            approverSignatureAndExpiry,
            approverSalt
        );

        emit OperatorAdded(operator, cloneAddress);
    }

    /// @inheritdoc IDepositManagerRestaker
    function removeOperator(
        address operator,
        address[] calldata newOperatorsArray,
        uint64[] calldata newDelegationPortions
    ) external {
        address delegator = operatorsDelegators[operator].delegator;
        address delegatedAddress = IDepositManagerGetters(address(this))
            .DELEGATION_MANAGER()
            .delegatedTo(delegator);

        // Ensure the delegator has no active stake before removal.
        if (delegatedAddress != address(0)) {
            revert EDelegatorHasActiveStake();
        }

        // Get the current number of operators.
        uint256 length = _operatorsArray.length;

        // Find and remove the operator from the array.
        for (uint256 i = 0; i < length; ++i) {
            if (_operatorsArray[i] == operator) {
                _operatorsArray[i] = _operatorsArray[length - 1];

                // slither-disable-next-line costly-loop
                delete operatorsDelegators[operator];

                // slither-disable-next-line costly-loop
                _operatorsArray.pop();
                break;
            }
        }

        // Update the delegation portions for the remaining operators.
        setOperatorsPortions(newOperatorsArray, newDelegationPortions);

        emit OperatorRemoved(operator);
    }

    /// @inheritdoc IDepositManagerRestaker
    function setOperatorsPortions(
        address[] calldata newOperatorsArray,
        uint64[] calldata delegationPortions
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 length = _operatorsArray.length;

        if (delegationPortions.length != length || newOperatorsArray.length != length) {
            revert EIncorrectLength();
        }

        uint256 portionsSum = 0;

        for (uint256 i = 0; i < length; ++i) {
            portionsSum += delegationPortions[i];
            _operatorsArray[i] = newOperatorsArray[i];
            operatorsDelegators[newOperatorsArray[i]].delegationPortion = delegationPortions[i];
        }

        // `portionsSum` must be equal to 100%.
        if (portionsSum != ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EWrongPortion();
        }

        emit OperatorsPortionsChanged(newOperatorsArray, delegationPortions);
    }

    /// @inheritdoc IDepositManagerRestaker
    function addStrategies(
        AddStrategyData[] calldata strategyData
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 length = strategyData.length;

        for (uint256 i = 0; i < length; ++i) {
            // Set the strategy data.
            _addStrategy(strategyData[i]);
        }

        // Emit the strategies added event.
        emit StrategiesAdded(strategyData);
    }

    /**
     * @dev Adds a single strategy for a specific token.
     * @param strategyData Struct containing the strategy data to add.
     */
    function _addStrategy(
        AddStrategyData calldata strategyData
    ) internal notZeroAddress(strategyData.token) {
        // Set the strategy data for interacting with EigenLayer and converting balance of token into ETH.
        strategies[strategyData.token] = TokenData(
            strategyData.newStrategy,
            strategyData.strategyLib,
            0
        );

        // Get stored strategy for validation.
        IStrategy strategy = getStrategy(strategyData.token);

        // Get delegation manager from `DepositManagerPool`.
        IDelegationManager delegationManager = IDepositManagerGetters(address(this))
            .DELEGATION_MANAGER();

        // Get the strategy manager contract.
        IStrategyManager strategyManager = delegationManager.strategyManager();

        // Validate that the strategy's underlying token matches the Vault's token
        // and that the strategy is whitelisted for deposits.

        if (address(strategy.underlyingToken()) != strategyData.token) {
            revert EInvalidStrategyConfiguration("Underlying token mismatch");
        }

        if (!strategyManager.strategyIsWhitelistedForDeposit(strategy)) {
            revert EInvalidStrategyConfiguration("Strategy not whitelisted");
        }
    }
}
