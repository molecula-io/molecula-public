// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {ICommonOracle} from "./interfaces/ICommonOracle.sol";
// solhint-disable-next-line no-unused-import
import {ISetterOracle, IOracle} from "./interfaces/ISetterOracle.sol";
import {ValueValidator} from "./ValueValidator.sol";

/**
 * @title CommonOracle
 * @notice Abstract contract that manages the Pool and share supply,
 *         as well as a registry of authorized Updater addresses.
 * @dev Provides the authorization logic for updaters using `{EnumerableSet}`,
 *      as well as storage and core logic for the Pool and share supply.
 *      Designed to be inherited by Oracle contracts that require controlled, owner-managed value updates.
 *      Only authorized updaters such as addresses in `{authorizedUpdaters}` can call the mutator functions.
 * @custom:abstract
 */
abstract contract CommonOracle is ICommonOracle, Ownable2Step, ValueValidator {
    /**
     * @dev Library for efficient management of a set of addresses. Used by Updaters.
     */
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ State Variables ============

    /**
     * @notice Set of addresses currently authorized as Updaters.
     * @dev Internal state variable, uses `{EnumerableSet.AddressSet}`
     *      for efficient addition, removal, enumeration, and check-up.
     *      Only addresses in this set may call value-changing functions marked with `{onlyAuthorizedUpdater}`.
     */
    EnumerableSet.AddressSet internal _authorizedUpdaters;

    /**
     * @notice Internal total Pool value tracked by the Oracle.
     * @dev Use `{getTotalPoolSupply}` for external access.
     */
    uint256 internal _pool;

    /**
     * @notice Internal total shares value tracked by the Oracle.
     * @dev Use `{getTotalSharesSupply}` for external access.
     */
    uint256 internal _shares;

    // ============ Modifiers ============

    /**
     * @notice Restricts function access to only authorized Updaters.
     * @dev Reverts with `{ENotAuthorized}` if called by a non-authorized address.
     */
    modifier onlyAuthorizedUpdater() {
        if (!_authorizedUpdaters.contains(msg.sender)) {
            revert ENotAuthorized();
        }
        _;
    }

    // ============ Constructor ============

    /**
     * @dev Initializes the Pool and shares, and sets the contract Owner.
     * @param initialShares Initial shares value for the Oracle.
     * @param initialPool Initial Pool value for the Oracle.
     * @param initialOwner Address to set as the contract owner.
     */
    constructor(
        uint256 initialShares,
        uint256 initialPool,
        address initialOwner
    ) Ownable(initialOwner) {
        _pool = initialPool;
        _shares = initialShares;
    }

    // ============ Core Functions ============

    /**
     * @inheritdoc ICommonOracle
     */
    function setAuthorizedUpdater(address authorizedUpdaterAddress) public virtual onlyOwner {
        _setUpdaterAuthorization(authorizedUpdaterAddress, true);
    }

    /**
     * @inheritdoc ICommonOracle
     */
    function removeAuthorizedUpdater(address authorizedUpdaterAddress) public virtual onlyOwner {
        _setUpdaterAuthorization(authorizedUpdaterAddress, false);
    }

    /**
     * @inheritdoc ISetterOracle
     */
    function setTotalPoolSupply(uint256 pool) public virtual onlyAuthorizedUpdater {
        _setTotalPoolSupply(pool);
    }

    /**
     * @inheritdoc ISetterOracle
     */
    function setTotalSharesSupply(uint256 shares) public virtual onlyAuthorizedUpdater {
        _setTotalSharesSupply(shares);
    }

    /**
     * @inheritdoc ISetterOracle
     */
    function setTotalSupply(uint256 pool, uint256 shares) public virtual onlyAuthorizedUpdater {
        _setTotalPoolSupply(pool);
        _setTotalSharesSupply(shares);
    }

    // ============ View Functions ============

    /**
     * @inheritdoc IOracle
     */
    function getTotalPoolSupply() public view virtual returns (uint256 pool) {
        return _pool;
    }

    /**
     * @inheritdoc IOracle
     */
    function getTotalSharesSupply() public view virtual returns (uint256 shares) {
        return _shares;
    }

    /**
     * @inheritdoc IOracle
     */
    function getTotalSupply() public view virtual returns (uint256 pool, uint256 shares) {
        return (_pool, _shares);
    }

    /**
     * @inheritdoc ICommonOracle
     */
    function isAuthorizedUpdater(address updater) public view virtual returns (bool) {
        return _authorizedUpdaters.contains(updater);
    }

    /**
     * @inheritdoc ICommonOracle
     */
    function getAuthorizedUpdaters() public view virtual returns (address[] memory) {
        return _authorizedUpdaters.values();
    }

    // ============ Internal Functions ============

    /**
     * @notice Sets the authorization status for an Updater address.
     * @dev Only callable internally. Child contracts must guard with `onlyOwner` or similar.
     *      Emits `{UpdaterAuthorizationChanged}` on the status change.
     *      Reverts with `{EAlreadyAuthorized}` on attempts to authorize an already authorized address.
     *      Reverts with `{ENotAuthorized}` on attempts to deauthorize an address that is not authorized.
     * @param updater Address to authorize or deauthorize.
     * @param authorize `True` to authorize, `false` to deauthorize.
     */
    function _setUpdaterAuthorization(
        address updater,
        bool authorize
    ) internal virtual notZeroAddress(updater) {
        if (authorize) {
            if (!_authorizedUpdaters.add(updater)) {
                revert EUpdaterAlreadyAuthorized();
            }
        } else {
            if (!_authorizedUpdaters.remove(updater)) {
                revert EUpdaterNotAuthorized();
            }
        }
        emit UpdaterAuthorizationChanged(updater, authorize);
    }

    /**
     * @notice Internal helper for updating the pool value and emitting {PoolChanged}.
     * @dev Does not apply access control—should be called from a function with proper authorization checks.
     * @param pool The new pool value.
     */
    function _setTotalPoolSupply(uint256 pool) internal virtual {
        if (_pool != pool) {
            _pool = pool;
            emit PoolChanged(pool);
        }
    }

    /**
     * @notice Internal helper for updating the shares value and emitting {SharesChanged}.
     * @dev Does not apply access control—should be called from a function with proper authorization checks.
     * @param shares The new shares value.
     */
    function _setTotalSharesSupply(uint256 shares) internal virtual {
        if (_shares != shares) {
            _shares = shares;
            emit SharesChanged(shares);
        }
    }
}
