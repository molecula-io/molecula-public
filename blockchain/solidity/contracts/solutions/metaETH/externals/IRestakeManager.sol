// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.24;

/**
 * Link to the original contract:
 * https://github.com/Renzo-Protocol/contracts-public/blob/v2.1/contracts/RestakeManager.sol#L296
 */

/**
 * @author  Renzo
 * @title   RestakeManager
 * @dev     This contract is the main entrypoint for external users into the protocol
            Users will interact with this contract to deposit and withdraw value into and from EigenLayer
            Ownership of deposited funds will be tracked via the ezETh token
 */
interface IRestakeManager {
    /// @dev This function calculates the TVLs for each operator delegator by individual token, total for each OD, and total for the protocol.
    /// @return operatorDelegatorTokenTVLs Each OD's TVL indexed by operatorDelegators array by collateralTokens array
    /// @return operatorDelegatorTVLs Each OD's Total TVL in order of operatorDelegators array
    /// @return totalTVL The total TVL across all operator delegators.
    /// Note: Any change to the structure of the function would require change in WithdrawQueue::_checkAvailableCollateralValue()
    function calculateTVLs() external view returns (uint256[][] memory, uint256[] memory, uint256);
}
