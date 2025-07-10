// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {PausableContract} from "./../../common/pausable/PausableContract.sol";
import {IMetaPoolTreasury} from "./../../solutions/metaETH/interfaces/IMetaPoolTreasury.sol";

/**
 * @title PausableExecute
 * @dev Abstract contract that implements the pause functionality for the execute operation.
 */
abstract contract PausableExecute is PausableContract {
    /// @dev Function selector for the execute operations from the IIssuer interface.
    bytes4 internal constant _EXECUTE_SELECTOR = IMetaPoolTreasury.execute.selector;

    /// @dev Initializes the contract by registering the `execute` function as pausable operations.
    constructor() {
        _addSelector(_EXECUTE_SELECTOR);
    }

    /// @dev Pauses the `execute` function.
    function pauseExecute() external virtual onlyAuthForPause {
        _setPause(_EXECUTE_SELECTOR, true);
    }

    /// @dev Unpauses the `execute` function.
    function unpauseExecute() external virtual onlyOwner {
        _setPause(_EXECUTE_SELECTOR, false);
    }

    /// @dev Checks if the execute functionality is paused.
    /// @return bool `true` if the execute is paused, `false` otherwise.
    function isExecutePaused() public view virtual returns (bool) {
        return isFunctionPaused[_EXECUTE_SELECTOR];
    }
}
