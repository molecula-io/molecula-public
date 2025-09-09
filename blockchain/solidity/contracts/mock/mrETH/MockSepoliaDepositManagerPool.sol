// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {DepositManagerPool} from "./../../solutions/mrETH/DepositManagerPool.sol";
import {IDepositManagerPool} from "./../../solutions/mrETH/interfaces/IDepositManagerPool.sol";

/**
 * @title Mock Deposit Manager contract for Sepolia.
 * @notice Manages deposits, withdrawals, and Pool operations for the mrETH protocol.
 * @dev This contract handles:
 * - Deposits and withdrawals of ETH, WETH, and other tokens.
 * - Pool management and rebalancing.
 * - Operator delegation and staking.
 * - Buffer management for maintaining liquidity.
 */
contract MockSepoliaDepositManagerPool is DepositManagerPool {
    /**
     * @dev Initializes the DepositManager contract with required addresses and configurations.
     * @param initialOwner_ Address that will own the contract.
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
        address supplyManager_,
        address weth_,
        address strategyFactory_,
        address delegationManager_,
        address rewardsCoordinator_,
        address delegatorImplementation_
    )
        DepositManagerPool(
            initialOwner_,
            supplyManager_,
            weth_,
            strategyFactory_,
            delegationManager_,
            rewardsCoordinator_,
            delegatorImplementation_
        )
    {}

    /// @inheritdoc IDepositManagerPool
    function totalRestakedSupply()
        public
        view
        virtual
        override
        returns (uint256 restakedTvl, uint256[] memory operatorDelegatorTVLs)
    {
        return (0, new uint256[](0));
    }

    /// @inheritdoc IDepositManagerPool
    function totalSupply() public view virtual override returns (uint256) {
        (uint256 bufferedTvl, ) = totalBufferedSupply();
        return bufferedTvl;
    }
}
