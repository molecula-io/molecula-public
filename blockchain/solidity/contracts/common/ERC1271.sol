// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ValueValidator} from "../common/ValueValidator.sol";

/**
 * @title ERC1271.
 * @notice This contract implements the ERC-1271 standard for contract-based signatures validation.
 * @dev Implementation of the ERC1271 standard for smart contract based signatures validation.
 *      Allows smart contracts to verify signatures based on arbitrary conditions and data.
 *      See https://eips.ethereum.org/EIPS/eip-1271 for more details.
 *      This contract is abstract and should be inherited by contracts that need signature validation capabilities.
 */
abstract contract ERC1271 is Ownable, ValueValidator {
    /// @dev Magic value returned by a smart contract when the signature validation passes.
    ///      This value is `bytes4(keccak256("isValidSignature(bytes32,bytes)"))`
    ///      and matches the ERC1271 standard interface.
    bytes4 internal constant _MAGIC_VALUE = 0x1626ba7e;

    /// @dev Magic value returned by a smart contract when the signature validation fails.
    ///      This value is `0xffffffff` and is returned when the signature is invalid
    ///      according to the ERC1271 standard interface.
    bytes4 internal constant _FAIL_VALUE = 0xffff_ffff;

    /// @dev Address authorized to sign messages on behalf of this contract.
    ///      This address is used to validate signatures in the `isValidSignature` function.
    address public signatureAuthority;

    /// @dev Emitted when a new signature authority is set.
    /// @param signer Address of the new authorized signer.
    event SignerSet(address indexed signer);

    /// @dev Constructor that sets the initial signer.
    /// @param signer_ Initial signer's address. Must not be the zero address.
    constructor(address signer_) notZeroAddress(signer_) {
        signatureAuthority = signer_;
    }

    /// @dev Updates the signer address. Can only be called by the contract owner.
    /// @param signer_ New signer's address. Must not be the zero address.
    function setSigner(address signer_) external virtual onlyOwner notZeroAddress(signer_) {
        signatureAuthority = signer_;
        emit SignerSet(signer_);
    }

    /// @dev Should return whether the signature provided is valid for the provided hash.
    /// @param _hash Hash of the data to be signed.
    /// @param _signature Signature byte array associated with `_hash`.
    /// @return result Bytes4 magic value equal to `0x1626ba7e` when the function passes. Otherwise, `0xffffffff`.
    function isValidSignature(
        bytes32 _hash,
        bytes calldata _signature
    ) external view virtual returns (bytes4 result) {
        // Validate signatures.
        result = ECDSA.recover(_hash, _signature) == signatureAuthority
            ? _MAGIC_VALUE
            : _FAIL_VALUE;
    }
}
