// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import {IERC20Provider} from "./../../common/rebase/interfaces/IERC20Provider.sol";
import {CommonOFTVault} from "./CommonOFTVault.sol";

contract MUSDOFTVault is CommonOFTVault, IERC20Provider {
    /**
     * @dev The address of the rebase token used for bridging operations.
     * This token is used for minting and burning shares during cross-chain operations.
     */
    address public immutable REBASE_TOKEN;

    /**
     * @dev Initializes the Vault, Oracle, and LayerZero endpoint information.
     * @param endpoint LayerZero endpoint address for cross-chain messaging.
     * @param ethereumEid EID representing Ethereum within LayerZero.
     * @param initialOwner Contract owner used for implementing the OApp and Ownable logic.
     * @param issuer IIssuer address authorized to mint and burn shares.
     * @param oracleAddress ISetterOracle address of the supply Oracle contract (SupplyManager's address in case of ETH).
     * @param underlyingToken Address of the underlying ERC20 token used for bridging (minting/burning shares) operations.
     */
    constructor(
        address endpoint,
        uint32 ethereumEid,
        address initialOwner,
        address issuer,
        address oracleAddress,
        address underlyingToken
    )
        CommonOFTVault(endpoint, ethereumEid, initialOwner, issuer, oracleAddress)
        notZeroAddress(underlyingToken)
    {
        REBASE_TOKEN = underlyingToken;
    }

    /**
     * @inheritdoc IERC20Provider
     */
    function getERC20Token() external view returns (address token) {
        token = REBASE_TOKEN;
    }
}
