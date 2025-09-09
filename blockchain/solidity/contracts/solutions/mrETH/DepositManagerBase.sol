// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IBufferInteractor} from "./interfaces/IBufferInteractor.sol";

/// @title Executor contract.
/// @notice Executes the deposits and withdrawals to the Pool.
contract DepositManagerBase {
    using Address for address;

    /**
     * @dev Deposits into a Pool using the assembly for gas optimization.
     * @param token Executed token's address.
     * @param pool Pool's address.
     * @param poolLib Pool library's address.
     * @param value Amount to deposit.
     */
    function _executeDeposit(
        address token,
        address pool,
        address poolLib,
        uint256 value
    ) internal virtual {
        // Get `calldata` for the deposit into the Pool.
        bytes memory data = IBufferInteractor(poolLib).encodeSupply(token, address(this), value);

        // slither-disable-next-line unused-return
        pool.functionCall(data);
    }

    /**
     * @dev Withdraws from a Pool using the assembly for gas optimization.
     * @param token Executed token's address.
     * @param pool Pool's address.
     * @param poolLib Pool library's address.
     * @param value Amount to withdraw.
     */
    function _executeWithdraw(
        address token,
        address pool,
        address poolLib,
        uint256 value
    ) internal virtual {
        // Get `calldata` for the withdrawal from the Pool.
        bytes memory data = IBufferInteractor(poolLib).encodeWithdraw(token, address(this), value);

        // slither-disable-next-line unused-return
        pool.functionCall(data);
    }
}
