// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {OFTVault} from "./../../../coreV2/OFTVault/OFTVault.sol";

contract TronOFTVault is OFTVault {
    /**
     * @dev Initializes the Vault, Oracle, and LayerZero endpoint information.
     * @param endpoint LayerZero endpoint address for cross-chain messaging.
     * @param ethereumEid EID representing Ethereum within LayerZero.
     * @param initialOwner Contract owner used for implementing the OApp and Ownable logic.
     * @param issuer IIssuer address authorized to mint and burn shares.
     * @param oracleAddress ISetterOracle address of the supply Oracle contract (SupplyManager's address in case of ETH).
     */
    constructor(
        address endpoint,
        uint32 ethereumEid,
        address initialOwner,
        address issuer,
        address oracleAddress
    ) OFTVault(endpoint, ethereumEid, initialOwner, issuer, oracleAddress) {}
}
