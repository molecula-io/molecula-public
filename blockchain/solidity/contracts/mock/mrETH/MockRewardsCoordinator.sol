// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRewardsCoordinatorTypes} from "../../solutions/mrETH/external/interfaces/IRewardsCoordinator.sol";

/// @title Mock Reward Coordinator contract for tests.
/// @notice Mock Reward Coordinator contract for tests.
/// @dev This contract is used to mock the Reward Coordinator contract for tests.
contract MockRewardsCoordinator {
    using SafeERC20 for IERC20;

    /**
     * @dev Process the claim for testing purposes.
     * @param claim `RewardsMerkleClaim` to be processed.
     * @param recipient Recipient address to get ERC20 rewards.
     */
    function processClaim(
        IRewardsCoordinatorTypes.RewardsMerkleClaim calldata claim,
        address recipient
    ) external {
        uint256 length = claim.tokenLeaves.length;
        for (uint256 i = 0; i < length; ++i) {
            IERC20 token = claim.tokenLeaves[i].token;
            token.safeTransfer(recipient, claim.tokenLeaves[i].cumulativeEarnings);
        }
    }
}
