// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title Permit
 * @dev Based on @openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol
 */
abstract contract Permit is IERC20Permit, EIP712, Nonces {
    // ============ Constants ============

    /// @dev Hashed representation of the `Permit` function signature as a string.
    bytes32 private constant _PERMIT_TYPEHASH =
        // solhint-disable-next-line gas-small-strings
        keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );

    // ============ Errors ============

    /**
     * @dev Deadline for the `Permit` function has expired.
     * @param deadline Deadline for the signature.
     */
    error ERC2612ExpiredSignature(uint256 deadline);

    /**
     * @dev Mismatched signature.
     * @param signer Signer's address.
     * @param owner Owner's address.
     */
    error ERC2612InvalidSigner(address signer, address owner);

    // ============ Core Functions ============

    /// @inheritdoc IERC20Permit
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        if (block.timestamp > deadline) {
            revert ERC2612ExpiredSignature(deadline);
        }

        bytes32 structHash = keccak256(
            abi.encode(_PERMIT_TYPEHASH, owner, spender, value, _useNonce(owner), deadline)
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        if (signer != owner) {
            revert ERC2612InvalidSigner(signer, owner);
        }

        _onPermit(owner, spender, value);
    }

    // ============ View Functions ============

    /**
     * @inheritdoc IERC20Permit
     */
    function nonces(
        address owner
    ) public view virtual override(IERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /**
     * @inheritdoc IERC20Permit
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view virtual returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============ Internal Functions ============

    /**
     * @dev Internal function to execute the permit functionality.
     * @param owner Owner of the funds.
     * @param spender Spender to be approved.
     * @param value Value.
     */
    function _onPermit(address owner, address spender, uint256 value) internal virtual;
}
