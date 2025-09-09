// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/interfaces/IERC5313.sol";
import "./interfaces/ISingleAdminAccessControl.sol";

/**
 * @title SingleAdminAccessControl.
 * @notice SingleAdminAccessControl is a contract that provides the single admin role.
 * @notice This contract is a simplified alternative to the OpenZeppelin's `AccessControlDefaultAdminRules`.
 */
abstract contract SingleAdminAccessControl is IERC5313, ISingleAdminAccessControl, AccessControl {
  address private _currentDefaultAdmin;
  address private _pendingDefaultAdmin;

  modifier notAdmin(bytes32 role) {
    if (role == DEFAULT_ADMIN_ROLE) revert InvalidAdminChange();
    _;
  }

  /// @notice Transfer the admin role to a new address.
  /// @notice This action can only be executed by the current admin.
  /// @param newAdmin Address.
  function transferAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (newAdmin == msg.sender) revert InvalidAdminChange();
    _pendingDefaultAdmin = newAdmin;
    emit AdminTransferRequested(_currentDefaultAdmin, newAdmin);
  }

  function acceptAdmin() external {
    if (msg.sender != _pendingDefaultAdmin) revert NotPendingAdmin();
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  /// @notice Grant a role.
  /// @notice This action can only be executed by the current admin.
  /// @notice Admin role cannot be granted externally.
  /// @param role Bytes32.
  /// @param account Address.
  function grantRole(bytes32 role, address account) public override onlyRole(DEFAULT_ADMIN_ROLE) notAdmin(role) {
    _grantRole(role, account);
  }

  /// @notice Revoke a role.
  /// @notice This action can only be executed by the current admin.
  /// @notice Admin role cannot be revoked.
  /// @param role Bytes32.
  /// @param account Address.
  function revokeRole(bytes32 role, address account) public override onlyRole(DEFAULT_ADMIN_ROLE) notAdmin(role) {
    _revokeRole(role, account);
  }

  /// @notice Renounce the `msg.sender` role.
  /// @notice Admin role cannot be renounced.
  /// @param role Bytes32.
  /// @param account Address.
  function renounceRole(bytes32 role, address account) public virtual override notAdmin(role) {
    super.renounceRole(role, account);
  }

  /**
   * @dev See {IERC5313-owner}.
   */
  function owner() public view virtual returns (address) {
    return _currentDefaultAdmin;
  }

  /**
   * @notice There is no way to change the admin without removing the old admin first.
   */
  function _grantRole(bytes32 role, address account) internal override {
    if (role == DEFAULT_ADMIN_ROLE) {
      emit AdminTransferred(_currentDefaultAdmin, account);
      _revokeRole(DEFAULT_ADMIN_ROLE, _currentDefaultAdmin);
      _currentDefaultAdmin = account;
      delete _pendingDefaultAdmin;
    }
    super._grantRole(role, account);
  }
}
