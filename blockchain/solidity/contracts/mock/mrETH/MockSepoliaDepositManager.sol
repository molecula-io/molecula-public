// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {DepositManager} from "./../../solutions/mrETH/DepositManager.sol";
import {IStrategy, IStrategyManager} from "./../../solutions/mrETH/external/interfaces/IStrategyManager.sol";
import {IDepositManager} from "./../../solutions/mrETH/interfaces/IDepositManager.sol";

/**
 * @title Mock Deposit Manager contract for Sepolia.
 * @notice Manages deposits, withdrawals, and Pool operations for the mrETH protocol.
 * @dev This contract handles:
 * - Deposits and withdrawals of ETH, WETH, and other tokens.
 * - Pool management and rebalancing.
 * - Operator delegation and staking.
 * - Buffer management for maintaining liquidity.
 */
contract MockSepoliaDepositManager is DepositManager {
    /**
     * @dev Initializes the DepositManager contract with required addresses and configurations.
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
        DepositManager(
            initialOwner_,
            authorizedStaker_,
            guardian_,
            supplyManager_,
            weth_,
            strategyFactory_,
            delegationManager_,
            rewardsCoordinator_,
            delegatorImplementation_
        )
    {}

    /// @inheritdoc IDepositManager
    function totalRestakedSupply()
        public
        view
        virtual
        override
        returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs)
    {
        // Get the Strategy Manager contract.
        IStrategyManager strategyManager = DELEGATION_MANAGER.strategyManager();

        // Initialize an array to store the TVL for each operator.
        uint256 operatorsLength = operatorsArray.length;
        operatorDelegatorTVLs = new uint256[](operatorsLength);

        for (uint256 i = 0; i < operatorsLength; ++i) {
            address delegator = operatorsDelegators[operatorsArray[i]].delegator;

            // Gets all deposit strategies.
            // slither-disable-next-line unused-return
            (IStrategy[] memory _strategies, ) = strategyManager.getDeposits(delegator);

            // Length of the `strategies` array.
            uint256 strategiesLength = _strategies.length;

            // TVL in ETH delegated to the chosen operator.
            uint256 operatorEthBalance;

            // Get all withdrawable tokens' amount from the EigenLayer's operator converted to ETH.
            for (uint256 j = 0; j < strategiesLength; ++j) {
                uint256 stakedAmount = _strategies[j].userUnderlyingView(delegator);
                operatorEthBalance += _convertTokenToETH(_strategies[j], stakedAmount);
            }

            // Add this operator's TVL to total and store in the array.
            restakedTvl += operatorEthBalance;
            operatorDelegatorTVLs[i] = operatorEthBalance;
        }
    }
}
