// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {ISetterOracle} from "./ISetterOracle.sol";

/// @dev ICommonOracle
interface ICommonOracle is ISetterOracle {
    // ============ Events ============

    /**
     * @dev Emitted when an updater's authorization status changes.
     * @param updater Address whose status is changed.
     * @param isAuthorized `True` if authorized, `false` otherwise.
     */
    event UpdaterAuthorizationChanged(address indexed updater, bool indexed isAuthorized);

    /**
     * @dev Emitted when the Pool value is changed.
     * @param newPool New Pool value.
     */
    event PoolChanged(uint256 indexed newPool);

    /**
     * @dev Emitted when the share value is changed.
     * @param newShares New share value.
     */
    event SharesChanged(uint256 indexed newShares);

    // ============ Errors ============

    /**
     * @dev Error thrown when attempting to authorize an address that is already authorized.
     */
    error EUpdaterAlreadyAuthorized();

    /**
     * @dev Error thrown when attempting to deauthorize or use an address that is not authorized as updater.
     */
    error EUpdaterNotAuthorized();

    // ============ View Functions ============

    /**
     * @dev Checks if an address is currently authorized as an updater.
     * @param updater Address to check.
     * @return `True` if the address is authorized, `false` otherwise.
     */
    function isAuthorizedUpdater(address updater) external view returns (bool);

    /**
     * @dev Returns the full list of authorized updaters.
     * @return Array of all currently authorized updater addresses.
     */
    function getAuthorizedUpdaters() external view returns (address[] memory);

    // ============ Core Functions ============

    /**
     * @notice Adds an authorized Updater address.
     * @dev Callable only by the contract Owner.
     * @param authorizedUpdaterAddress Address to authorize as an Updater.
     */
    function setAuthorizedUpdater(address authorizedUpdaterAddress) external;

    /**
     * @notice Removes an authorized Updater address.
     * @dev Callable only by the contract Owner.
     * @param authorizedUpdaterAddress Address to deauthorize as an Updater.
     */
    function removeAuthorizedUpdater(address authorizedUpdaterAddress) external;
}
