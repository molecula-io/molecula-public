/**
 * Link to the original contract:
 * https://github.com/Layr-Labs/eigenlayer-contracts/blob/main/src/contracts/interfaces/IPermissionController.sol
 */
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.27;

interface IPermissionControllerEvents {
    /// @notice Emitted when an appointee is set for an account to handle specific function calls.
    event AppointeeSet(
        address indexed account,
        address indexed appointee,
        address target,
        bytes4 selector
    );

    /// @notice Emitted when an appointee's permission to handle function calls for an account is revoked.
    event AppointeeRemoved(
        address indexed account,
        address indexed appointee,
        address target,
        bytes4 selector
    );

    /// @notice Emitted when an address is set as a pending admin for an account, requiring acceptance.
    event PendingAdminAdded(address indexed account, address admin);

    /// @notice Emitted when a pending admin status is removed for an account before acceptance.
    event PendingAdminRemoved(address indexed account, address admin);

    /// @notice Emitted when an address accepts and becomes an active admin for an account.
    event AdminSet(address indexed account, address admin);

    /// @notice Emitted when an admin's permissions are removed from an account.
    event AdminRemoved(address indexed account, address admin);
}

interface IPermissionController is IPermissionControllerEvents {
    /**
     * @notice Sets a pending admin for an account.
     * @param account Account for setting the pending admin.
     * @param admin Address to set as a pending admin.
     * @dev Pending admin must accept the role before becoming an active admin.
     * @dev Multiple admins can be set for a single account.
     */
    function addPendingAdmin(address account, address admin) external;

    /**
     * @notice Removes a pending admin from an account before they have accepted the role.
     * @param account Account for removing the pending admin.
     * @param admin Pending admin address to remove.
     * @dev Only an existing admin of the account can remove a pending admin.
     */
    function removePendingAdmin(address account, address admin) external;

    /**
     * @notice Allows a pending admin to accept their admin role for an account.
     * @param account Account for accepting the admin role.
     * @dev Only addresses previously set as pending admins can accept the role.
     */
    function acceptAdmin(address account) external;

    /**
     * @notice Removes an active admin from an account.
     * @param account Account for removing the admin.
     * @param admin Admin address to remove.
     * @dev Only an existing admin of the account can remove another admin.
     * @dev Function will revert if removing this admin would leave the account with zero admins.
     */
    function removeAdmin(address account, address admin) external;

    /**
     * @notice Sets an appointee who can call specific functions on behalf of an account.
     * @param account Account for setting the appointee.
     * @param appointee Address to receive the permission.
     * @param target Contract address the appointee can interact with.
     * @param selector Function selector the appointee can call.
     * @dev Only an admin of the account can set appointees.
     */
    function setAppointee(
        address account,
        address appointee,
        address target,
        bytes4 selector
    ) external;

    /**
     * @notice Removes an appointee's permission to call a specific function.
     * @param account Account for removing the appointee.
     * @param appointee Appointee address to remove.
     * @param target Contract address for removing permissions.
     * @param selector Function selector for removing permissions.
     * @dev Only an admin of the account can remove appointees.
     */
    function removeAppointee(
        address account,
        address appointee,
        address target,
        bytes4 selector
    ) external;

    /**
     * @notice Checks if a given address is an admin of an account.
     * @param account Account for checking the admin status.
     * @param caller Address to check.
     * @dev If the account is the caller that has no admins, returns `true`.
     * @return bool Returns `true` if the caller is an admin, `false` otherwise.
     */
    function isAdmin(address account, address caller) external view returns (bool);

    /**
     * @notice Checks if an address is currently a pending admin for an account.
     * @param account Account for checking the pending admin status.
     * @param pendingAdmin Address to check.
     * @return bool Returns `true` if the address is a pending admin, `false` otherwise.
     */
    function isPendingAdmin(address account, address pendingAdmin) external view returns (bool);

    /**
     * @notice Retrieves all active admins for an account.
     * @param account Account for getting the admins.
     * @dev If the account has no admins, returns an array containing only the account address.
     * @return address[] Array of admin addresses.
     */
    function getAdmins(address account) external view returns (address[] memory);

    /**
     * @notice Retrieves all pending admins for an account.
     * @param account Account for getting the pending admins.
     * @return Array of pending admin addresses.
     */
    function getPendingAdmins(address account) external view returns (address[] memory);

    /**
     * @notice Checks if a caller has permission to call a specific function.
     * @param account Account for checking permissions.
     * @param caller Address attempting to make the call.
     * @param target Contract address being called.
     * @param selector Function selector being called.
     * @dev Returns `true` if the caller is either an admin or an appointed caller.
     * @dev Note: upgrades to the contract may invalidate the appointee's permissions.
     * This is only possible if a function's selector changes. E.g., if a function's parameters are modified.
     * @return Returns `true` if the caller has permission, `false` otherwise.
     */
    function canCall(
        address account,
        address caller,
        address target,
        bytes4 selector
    ) external returns (bool);

    /**
     * @notice Retrieves all permissions granted to an appointee for a given account.
     * @param account Account for checking appointee permissions.
     * @param appointee Appointee address to check.
     * @return address[], bytes4[] Two arrays: target contract addresses and their corresponding function selectors.
     */
    function getAppointeePermissions(
        address account,
        address appointee
    ) external returns (address[] memory, bytes4[] memory);

    /**
     * @notice Retrieves all appointees that can call a specific function for an account.
     * @param account Account for getting appointees.
     * @param target Contract address to check.
     * @param selector Function selector to check.
     * @dev Does not include admins in the returned list, even though they have calling permission.
     * @return address[] Array of appointee addresses.
     */
    function getAppointees(
        address account,
        address target,
        bytes4 selector
    ) external returns (address[] memory);
}
