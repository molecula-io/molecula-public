// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {RebaseERC20} from "../../common/rebase/RebaseERC20.sol";
import {IwmUSD} from "./IwmUSD.sol";

interface IlmUSD {
    /**
     * @dev Lock information.
     * @param shares Locked shares.
     * @param period Lock period.
     * @param createdAt Lock creation timestamp.
     */
    struct LockInfo {
        uint256 shares;
        uint128 period;
        uint128 createdAt;
    }

    /**
     * @dev Lock period information.
     * @param exists Boolean flag indicating whether the lock period exists.
     * @param isAllowed Boolean flag indicating whether the lock period is allowed.
     * @param multiplier Multiplier for the lock period.
     * @param mUSDLockedShares Total amount of mUSD locked shares for the period.
     */
    struct PeriodInfo {
        bool exists;
        bool isAllowed;
        uint128 multiplier;
        uint256 mUSDLockedShares;
    }

    /// @dev Returns mUSD token address.
    /// @return mUSD token address.
    // solhint-disable-next-line func-name-mixedcase
    function MUSD() external returns (RebaseERC20);

    /// @dev Returns wmUSD token address.
    /// @return wmUSD token address.
    // solhint-disable-next-line func-name-mixedcase
    function WMUSD_TOKEN() external returns (IwmUSD);

    /// @dev Mapping `tokenId` to the lock information.
    /// See also the `LockInfo` structure.
    /// @param tokenId `tokenId` whose information is to be returned.
    /// @return shares Locked shares.
    /// @return period Lock period.
    /// @return createdAt Lock creation timestamp.
    function lockInfos(
        uint256 tokenId
    ) external returns (uint256 shares, uint128 period, uint128 createdAt);

    /// @dev Returns mUSD locked shares in the contract.
    /// @return mUSD locked shares in the contract.
    function mUSDLockedShares() external returns (uint256);

    /// @dev Mapping period to the period information.
    /// See also PeriodInfo structure.
    /// @param period Lock period.
    /// @return exists Boolean flag indicating whether the lock period exists.
    /// @return isAllowed Boolean indicating whether the lock period is allowed.
    /// @return multiplier Multiplier for the lock period.
    /// @return summUSDLockedShares Total amount of mUSD locked shares for the period.
    function periodInfos(
        uint128 period
    )
        external
        returns (bool exists, bool isAllowed, uint128 multiplier, uint256 summUSDLockedShares);

    /**
     * @dev Constructor for initializing the contract.
     * @param mUSDAmount Amount of mUSD tokens to lock.
     * @param period Lock period.
     */
    function lock(uint256 mUSDAmount, uint128 period) external;

    /**
     * @dev Returns the token ID's shares.
     * @param tokenId Token ID.
     * @return lockedShares Locked shares.
     * @return dedicatedShares Current yield shares.
     */
    function sharesOf(
        uint256 tokenId
    ) external view returns (uint256 lockedShares, uint256 dedicatedShares);

    /**
     * @dev Returns the `tokenId`'s balance.
     * @param tokenId `tokenId` whose balance is to be returned.
     * @return balance `tokenId`'s balance.
     */
    function balanceOf(uint256 tokenId) external view returns (uint256 balance);

    /**
     * @dev Unlock the token ID.
     * @param tokenId Token ID.
     */
    function unlock(uint256 tokenId) external;

    /**
     * @dev Add period.
     * @param period Lock period.
     * @param multiplier Multiplier for the lock period.
     */
    function addPeriod(uint128 period, uint128 multiplier) external;

    /**
     * @dev Allow or disallow users to lock their tokens with the lock period.
     * @param period Lock period.
     * @param isAllowed Boolean indicating whether the lock period is allowed.
     */
    function setAllowPeriod(uint128 period, bool isAllowed) external;

    /**
     * @dev Delete the lock period.
     * @param index Index of the lock period in the `_periods` array.
     * @param period Lock period.
     */
    function deletePeriod(uint256 index, uint128 period) external;

    /// @dev Returns possible periods for locking the user's mUSD tokens.
    /// @return Possible periods for locking the user's mUSD tokens.
    function getPeriods() external view returns (uint128[] memory);

    /// @dev Event emitted when the period is added.
    /// @param period Lock period.
    /// @param multiplier Multiplier for the lock period.
    event PeriodAdded(uint128 indexed period, uint128 indexed multiplier);

    /// @dev Event emitted when the period is allowed or disallowed.
    /// @param period Lock period.
    /// @param isAllowed Boolean indicating whether the lock period is allowed.
    event SetAllowPeriod(uint128 indexed period, bool indexed isAllowed);

    /// @dev Event emitted when the period is deleted.
    /// @param period Lock period.
    event PeriodDeleted(uint128 indexed period);

    /// @dev Event emitted when user has locked their mUSD tokens.
    /// @param sender Owner of lock.
    /// @param tokenId Token ID.
    /// @param shares Locked shares.
    /// @param period Lock period.
    /// @param createdAt Lock creation timestamp.
    event Locked(
        address indexed sender,
        uint256 indexed tokenId,
        uint256 shares,
        uint128 indexed period,
        uint128 createdAt
    );

    /// @dev Event emitted when user has unlocked their mUSD tokens.
    /// @param sender Owner of lock.
    /// @param tokenId Token ID.
    /// @param shares Locked shares.
    /// @param period Lock period.
    /// @param createdAt Lock creation timestamp.
    event Unlocked(
        address indexed sender,
        uint256 indexed tokenId,
        uint256 shares,
        uint128 indexed period,
        uint128 createdAt
    );

    /// @dev Error: wrong index or lock period.
    error EWrongIndexOrPeriod();

    /// @dev Error: adding lock period has been already added.
    error EPeriodIsAlreadyExist();

    /// @dev Error: lock period does not exist.
    error EPeriodDoesNotExist();

    /// @dev Error: lock period has shares.
    error EPeriodHasShares();

    /// @dev Error: lock period is not allowed.
    error ENotAllowedPeriod();

    /// @dev Error: the token is still locked.
    error ETokenIsStillLocked();

    /// @dev Error: `msg.sender` is not authorized for some function.
    error ENotAuthorized();

    /// @dev The value has been already set.
    error EAlreadySet();

    /// @dev Error: the array has wrong length.
    error EBadLength();
}
