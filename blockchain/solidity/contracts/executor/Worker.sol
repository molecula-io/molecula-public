// SPDX-License-Identifier: LZBL-1.2
// copied from https://github.com/LayerZero-Labs/LayerZero-v2/blob/main/packages/layerzero-v2/evm/messagelib/contracts/Worker.sol
pragma solidity ^0.8.24;

import {IWorker} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/interfaces/IWorker.sol";
import {ISendLib} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ISendLib.sol";
import {Transfer} from "@layerzerolabs/lz-evm-protocol-v2/contracts/libs/Transfer.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ValueValidator} from "../common/ValueValidator.sol";

abstract contract Worker is AccessControl, Pausable, IWorker, ValueValidator {
    /// @dev Role for contracts allowed to assign jobs (messaging libraries).
    bytes32 internal constant _MESSAGE_LIB_ROLE = keccak256("MESSAGE_LIB_ROLE");
    /// @dev Role representing addresses in the allowlist.
    bytes32 internal constant _ALLOWLIST = keccak256("ALLOWLIST");
    /// @dev Role representing addresses in the denylist.
    bytes32 internal constant _DENYLIST = keccak256("DENYLIST");
    /// @dev Admin role for configuration changes.
    bytes32 internal constant _ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @dev Address of the ExecutorFeeLib contract used for fee computations.
    address public workerFeeLib;
    /// @dev Number of addresses currently in the allowlist.
    uint64 public allowlistSize;
    /// @dev Default multiplier (in basis points) applied to computed fees.
    uint16 public defaultMultiplierBps;
    /// @dev Address of the external price feed used by ExecutorFeeLib.
    address public priceFeed;
    /// @dev Mapping of remote LZ EIDs to supported option type codes.
    mapping(uint32 eid => uint8[] optionTypes) internal _supportedOptionTypes;

    // ========================= Constructor =========================

    /**
     * @dev Initialize Worker with initial libraries, admin, price feed, and roles.
     * @param _messageLibs Array of message lib addresses that are granted the MESSAGE_LIB_ROLE.
     * @param _priceFeed Price feed address (for fee quoting).
     * @param _defaultMultiplierBps Default fee multiplier (bps).
     * @param _roleAdmin Address that is granted the DEFAULT_ADMIN_ROLE (can grant and revoke all roles).
     * @param _admins Array of admin addresses that are granted the ADMIN_ROLE.
     */
    constructor(
        address[] memory _messageLibs,
        address _priceFeed,
        uint16 _defaultMultiplierBps,
        address _roleAdmin,
        address[] memory _admins
    ) {
        defaultMultiplierBps = _defaultMultiplierBps;
        priceFeed = _priceFeed;

        if (_roleAdmin != address(0x0)) {
            // _roleAdmin can grant and revoke all roles
            _grantRole(DEFAULT_ADMIN_ROLE, _roleAdmin);
        }

        // solhint-disable-next-line gas-length-in-loops
        for (uint256 i = 0; i < _messageLibs.length; ++i) {
            // Grant _MESSAGE_LIB_ROLE to all provided message libraries
            _grantRole(_MESSAGE_LIB_ROLE, _messageLibs[i]);
        }

        // solhint-disable-next-line gas-length-in-loops
        for (uint256 i = 0; i < _admins.length; ++i) {
            // Grant _ADMIN_ROLE to all provided admin addresses
            _grantRole(_ADMIN_ROLE, _admins[i]);
        }
    }

    // ========================= Modifier =========================

    /**
     * @dev Modifier that restricts access to only those passing the ACL check.
     *      Can be used to guard fee queries, job assignments, etc.
     * @param _sender Address to check ACL against.
     */
    modifier onlyAcl(address _sender) {
        if (!hasAcl(_sender)) {
            revert Worker_NotAllowed();
        }
        _;
    }

    /**
     * @dev Access control list logic.
     *      - If sender is in denylist: always denied
     *      - If allowlist is empty or sender is in allowlist: allowed
     *      - Else: denied
     * @param _sender Address to check for ACL.
     * @return True if allowed, false otherwise.
     */
    function hasAcl(address _sender) public view returns (bool) {
        if (hasRole(_DENYLIST, _sender)) {
            return false;
        } else if (allowlistSize == 0 || hasRole(_ALLOWLIST, _sender)) {
            // If allowlist is empty (open mode) or sender is in allowlist
            return true;
        } else {
            return false;
        }
    }

    // ========================= OnyDefaultAdmin =========================

    /**
     * @dev Pauses or unpauses contract (if used with whenNotPaused).
     *      Only callable by DEFAULT_ADMIN_ROLE.
     * @param _paused True to pause, false to unpause.
     */
    function setPaused(bool _paused) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    // ========================= OnlyAdmin =========================

    /**
     * @dev Updates the price feed contract used for fee calculation.
     *      Only callable by ADMIN_ROLE.
     * @param _priceFeed New price feed address.
     */
    function setPriceFeed(
        address _priceFeed
    ) external onlyRole(_ADMIN_ROLE) notZeroAddress(_priceFeed) {
        priceFeed = _priceFeed;
        emit SetPriceFeed(_priceFeed);
    }

    /**
     * @dev Updates ExecutorFeeLib address used for all fee calculations.
     *      Only callable by ADMIN_ROLE.
     * @param _workerFeeLib Address of new ExecutorFeeLib contract.
     */
    function setWorkerFeeLib(
        address _workerFeeLib
    ) external onlyRole(_ADMIN_ROLE) notZeroAddress(_workerFeeLib) {
        workerFeeLib = _workerFeeLib;
        emit SetWorkerLib(_workerFeeLib);
    }

    /**
     * @dev Updates the default fee multiplier (basis points).
     *      Only callable by ADMIN_ROLE.
     * @param _multiplierBps New default multiplier (bps).
     */
    function setDefaultMultiplierBps(uint16 _multiplierBps) external onlyRole(_ADMIN_ROLE) {
        defaultMultiplierBps = _multiplierBps;
        emit SetDefaultMultiplierBps(_multiplierBps);
    }

    /**
     * @dev Withdraws protocol fees from supported message ULN libraries.
     *      Only callable by ADMIN_ROLE. Library must have MESSAGE_LIB_ROLE.
     * @param _lib Message library address to withdraw from.
     * @param _to Recipient address.
     * @param _amount Amount to withdraw.
     */
    function withdrawFee(
        address _lib,
        address _to,
        uint256 _amount
    ) external onlyRole(_ADMIN_ROLE) {
        if (!hasRole(_MESSAGE_LIB_ROLE, _lib)) revert Worker_OnlyMessageLib();
        // Call withdrawFee on the underlying library
        ISendLib(_lib).withdrawFee(_to, _amount);
        emit Withdraw(_lib, _to, _amount);
    }

    /**
     * @dev Withdraws ERC20 tokens or native currency.
     * @param _token Token address (use address(0) for native).
     * @param _to Recipient address.
     * @param _amount Amount to withdraw.
     */
    function withdrawToken(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyRole(_ADMIN_ROLE) {
        // transfers native if _token is address(0x0)
        Transfer.nativeOrToken(_token, _to, _amount);
    }

    /**
     * @dev Set supported option type codes for a given remote endpoint.
     *      Used for feature upgrades, testing, or protocol extension.
     *      Only callable by ADMIN_ROLE.
     * @param _eid Endpoint ID.
     * @param _optionTypes List of supported option codes.
     */
    function setSupportedOptionTypes(
        uint32 _eid,
        uint8[] calldata _optionTypes
    ) external onlyRole(_ADMIN_ROLE) {
        _supportedOptionTypes[_eid] = _optionTypes;
    }

    // ========================= View Functions =========================

    /**
     * @dev Returns the list of supported option types for a given remote endpoint.
     * @param _eid Endpoint ID.
     * @return Array of option type codes.
     */
    function getSupportedOptionTypes(uint32 _eid) external view returns (uint8[] memory) {
        return _supportedOptionTypes[_eid];
    }

    // ========================= Internal Functions =========================

    /**
     * @dev Overrides AccessControl's _grantRole to increment allowlistSize as needed.
     * @param _role Role to grant.
     * @param _account Address to grant role to.
     * @return True if role was granted, false otherwise.
     */
    function _grantRole(bytes32 _role, address _account) internal override returns (bool) {
        if (_role == _ALLOWLIST && !hasRole(_role, _account)) {
            ++allowlistSize;
        }
        return super._grantRole(_role, _account);
    }

    /**
     * @dev Overrides AccessControl's _revokeRole to decrement allowlistSize as needed.
     * @param _role Role to revoke.
     * @param _account Address to revoke role from.
     * @return True if role was revoked, false otherwise.
     */
    function _revokeRole(bytes32 _role, address _account) internal override returns (bool) {
        if (_role == _ALLOWLIST && hasRole(_role, _account)) {
            --allowlistSize;
        }
        return super._revokeRole(_role, _account);
    }

    /**
     * @dev Overrides AccessControl to disable renouncing of roles.
     * Disable renouncing roles to prevent accidental loss of permissions.
     */
    function renounceRole(bytes32 /*role*/, address /*account*/) public pure override {
        revert Worker_RoleRenouncingDisabled();
    }
}
