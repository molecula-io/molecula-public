// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {ILayerZeroEndpointV2} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISetterOracle} from "./../../common/interfaces/ISetterOracle.sol";
import {ValueValidator} from "./../../common/ValueValidator.sol";
import {IIssuer} from "./../../coreV2/interfaces/IIssuer.sol";
import {ERC7540Operator} from "./../TokenVault/ERC7540Operator.sol";
import {IOFTVault} from "./interfaces/IOFTVault.sol";

/**
 * @title OFTVault
 * @notice Cross-chain Vault for bridging shares (e.g., mUSD) and synchronizing supply data via LayerZero v2.
 * @dev Handles bridging, burning, minting, and synchronizing total supply with an on-chain Oracle. Uses LayerZero OApp v2 messaging.
 */
contract OFTVault is
    Ownable2Step,
    OApp,
    ERC7540Operator,
    ReentrancyGuard,
    ValueValidator,
    IOFTVault
{
    using OptionsBuilder for bytes;

    // ============ State Variables ============

    /// @dev Local endpoint ID. LayerZero V2 context only, for read calls.
    uint32 internal immutable _LOCAL_EID_V2;

    /// @dev Constant for the LayerZero EID representing Ethereum.
    uint32 internal immutable _ETHEREUM_EID;

    /// @dev Address of the Oracle contract used for total supply synchronization.
    address public immutable ORACLE;

    /// @dev Address of the IIssuer-compliant contract responsible for minting and burning.
    address public immutable ISSUER;

    /// @dev Per-EID configuration of LayerZero, receive gas limits.
    ///      Must be set for every destination chain before bridging. Otherwise, the bridging will revert.
    mapping(uint32 => uint128) public lzReceiveGasLimit;

    // ============ Constructor ============

    /**
     * @dev Initializes the Vault, Oracle, and LayerZero endpoint information.
     * @param endpoint LayerZero endpoint address for cross-chain messaging.
     * @param ethereumEid EID representing Ethereum within LayerZero.
     * @param initialOwner Contract owner used for implementing the OApp and Ownable logic.
     * @param rebaseTokenOwner IIssuer address authorized to mint and burn shares.
     * @param oracle ISetterOracle address of the supply Oracle contract.
     */
    constructor(
        address endpoint,
        uint32 ethereumEid,
        address initialOwner,
        address rebaseTokenOwner,
        address oracle
    )
        OApp(endpoint, initialOwner)
        Ownable(initialOwner)
        notZero(ethereumEid)
        notZeroAddress(rebaseTokenOwner)
        notZeroAddress(oracle)
    {
        _ETHEREUM_EID = ethereumEid;
        ISSUER = rebaseTokenOwner;
        ORACLE = oracle;
        _LOCAL_EID_V2 = ILayerZeroEndpointV2(endpoint).eid();
    }

    // ============ Core Functions ============
    /**
     * @dev Overrides the `transferOwnership` function to resolve conflicts.
     * @param newOwner New owner's address.
     */
    function transferOwnership(address newOwner) public override(Ownable2Step, Ownable) onlyOwner {
        super.transferOwnership(newOwner);
    }

    /**
     * @dev Returns the LayerZero message fee, payload, and options for a bridge request.
     * @param shares Amount of shares to bridge.
     * @param receiver Recipient address on the destination chain.
     * @param dstEid Destination LayerZero Endpoint ID.
     * @return fee `MessagingFee` struct with the required native and lzToken fee.
     * @return payload Encoded message payload for LayerZero.
     * @return lzOptions LayerZero options used in messaging.
     */
    function quote(
        uint256 shares,
        address receiver,
        uint32 dstEid
    ) public view returns (MessagingFee memory fee, bytes memory payload, bytes memory lzOptions) {
        // Build the payload with the same logic as with the bridging.
        payload = _buildPayload(shares, receiver);
        // Build LayerZero message options.
        lzOptions = _buildOptions(dstEid);
        // Get the LayerZero fee in the native gas token.
        fee = _quote(dstEid, payload, lzOptions, false);
    }

    /**
     * @notice Set a custom LayerZero receive gas limit for the given destination EID.
     * @dev Setting the limit to zero will revert to using the contract's `DEFAULT_LZ_RECEIVE_GAS_LIMIT`.
     * @param eid LayerZero endpoint ID of the destination chain.
     * @param gasLimit Desired gas limit for the LayerZero message received on this destination.
     */
    function setLzReceiveGasLimit(
        uint32 eid,
        uint128 gasLimit
    ) external notZero(eid) notZero(gasLimit) onlyOwner {
        lzReceiveGasLimit[eid] = gasLimit;
    }

    /**
     * @inheritdoc IOFTVault
     * @notice Initiates a cross-chain bridge operation to transfer shares to another chain.
     * @dev This function:
     *      - Prepares a LayerZero payload, including supply synchronization if on Ethereum.
     *      - Quotes the required messaging fee.
     *      - Sends the cross-chain message via LayerZero.
     *      - Burns the corresponding shares from the owner's balance.
     *
     *      Steps:
     *      1. Checks the operator permission for `owner`, which prevents unauthorized bridges.
     *      2. Calls the public `quote` function to compute the LayerZero payload, options, and fee:
     *         - The payload includes the Oracle supply data if bridging from Ethereum.
     *         - LayerZero options (e.g., gas limit) are consistently set.
     *         - The returned fee is what must be provided by the caller as `msg.value`.
     *      3. Sends the LayerZero message with `_lzSend`:
     *         - Includes the prepared payload, LayerZero options, quoted fee, and the initiator's address.
     *         - This ensures atomicity between the bridge intent and fee consumption.
     *      4. Burns the specified amount of shares from the owner's account using the IIssuer contract:
     *         - This prevents double-bridging or minting of shares on the source chain.
     *      5. Reentrancy is guarded by `nonReentrant`, following security best practices.
     *      6. Any revert during `_lzSend` or `burn` ensures the state is not mutated.
     *
     *      Requirements:
     *      - `onlyOperator(owner)`: Caller must be authorized as an operator for `owner`.
     *      - `msg.value` must be sufficient to cover the LayerZero fee (quoted via `quote`).
     *      - `shares` must not exceed the owner's balance, enforced by IIssuer.
     */
    function bridge(
        uint256 shares,
        address receiver,
        address owner,
        uint32 dstEid
    ) external payable nonReentrant onlyOperator(owner) {
        // 1. Call the public `quote()` function to get the fee, payload, and options.
        (MessagingFee memory fee, bytes memory payload, bytes memory lzOptions) = quote(
            shares,
            receiver,
            dstEid
        );

        // 2. Send a message via LayerZero with the prepared data.
        //    - If `msg.value` is insufficient, `_lzSend` will revert.
        //    - No funds are transferred to the Vault itself. All `msg.value` goes to LayerZero.
        _lzSend(dstEid, payload, lzOptions, fee, msg.sender);

        // 3. Burn the specified number of shares from the owner's balance.
        IIssuer(ISSUER).burn(owner, shares);
    }

    // ============ Internal Functions ============

    /**
     * @dev Overrides the `_transferOwnership` function to resolve conflicts.
     * @param newOwner New owner's address.
     */
    function _transferOwnership(address newOwner) internal override(Ownable2Step, Ownable) {
        super._transferOwnership(newOwner);
    }

    /**
     * @dev Builds the LayerZero payload for bridging, including the total supply synchronization if on Ethereum.
     * @param shares Amount of shares to bridge.
     * @param receiver Recipient address on the destination chain.
     * @return payload Encoded message payload.
     */
    function _buildPayload(
        uint256 shares,
        address receiver
    ) internal view virtual returns (bytes memory payload) {
        if (_LOCAL_EID_V2 == _ETHEREUM_EID) {
            // If bridging from Ethereum, include the total supply data.
            (uint256 pool, uint256 sharesSupply) = ISetterOracle(ORACLE).getTotalSupply();
            payload = abi.encode(shares, receiver, pool, sharesSupply);
        } else {
            // For all the other chains, send only the share and receiver data.
            payload = abi.encode(shares, receiver);
        }
    }

    /**
     * @dev Builds LayerZero options with the required receive gas limit for the given destination EID.
     *      Reverts if no gas limit is set for this destination chain.
     * @param dstEid Destination LayerZero EID (chain ID).
     * @return lzOptions Options' bytes, including per-EID gas limit.
     */
    function _buildOptions(uint32 dstEid) internal view returns (bytes memory lzOptions) {
        lzOptions = OptionsBuilder.newOptions().addExecutorLzReceiveOption(
            lzReceiveGasLimit[dstEid],
            0
        );
    }

    /**
     * @notice Internal LayerZero message handler, called on message receipt.
     * @dev Decodes payload differently based on srcEid: if from Ethereum, expects the supply synchronization data.
     *      Synchronizes supply (Oracle) if present, mints shares to the receiver.
     * @param _origin Struct containing information about where the packet came from.
     * param _guid Global ID for tracking the packet.
     * param _executor Executor address as specified by the OApp.
     * param _options Extra data or options to trigger upon receipt.
     * @param payload Encoded message.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_options*/
    ) internal override {
        _processReceivedMessage(_origin.srcEid, payload);
    }

    /**
     * @notice Mints shares to the receiver upon successful message receipt.
     * @dev Only callable internally, after LayerZero message validation.
     * @param _srcEid Source Endpoint ID.
     * @param _payload Encoded message.
     */
    function _processReceivedMessage(uint256 _srcEid, bytes calldata _payload) internal virtual {
        uint256 shares = 0;
        // slither-disable-next-line uninitialized-local
        address receiver;
        uint256 pool = 0;
        uint256 oracleShares = 0;
        if (_srcEid == _ETHEREUM_EID && _payload.length == 128) {
            // If the message came from Ethereum, decode with Oracle data and synchronize the local Oracle.
            (shares, receiver, pool, oracleShares) = abi.decode(
                _payload,
                (uint256, address, uint256, uint256)
            );
            // Synchronize the Oracle total supply.
            ISetterOracle(ORACLE).setTotalSupply(pool, oracleShares);
        } else if (_srcEid != _ETHEREUM_EID && _payload.length == 64) {
            // From other chains, decode only the share and receiver data.
            (shares, receiver) = abi.decode(_payload, (uint256, address));
        } else {
            revert InvalidMessage();
        }
        // Mint shares to the receiver using the IIssuer interface.
        IIssuer(ISSUER).mint(receiver, shares);
    }
}
