// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import {IOFT, SendParam, MessagingReceipt, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

interface IUsdtOFT is IOFT {
    /// ========================== EVENTS =====================================
    event LpAdminSet(address lpAdmin);
    event PlannerSet(address planner);
    event BurnAndNilifyAdminSet(address burnAndNilifyAdmin);
    event FeeBpsSet(uint16 feeBps);
    event FeesWithdrawn(address to, uint256 amount);

    event LocalDeposit(uint256 amount);
    event LocalWithdrawn(address to, uint256 amount);
    event RemoteWithdrawn(bytes32 guid, uint32 dstEid, uint256 amount);
    event RemoteWithdrawReceived(bytes32 guid, uint32 srcEid, address to, uint256 amount);
    event CreditsSent(
        uint32 dstEid,
        uint64 creditsArbitrum,
        uint64 creditsCelo,
        uint64 creditsEth,
        uint64 creditsSolana,
        uint64 creditsTon,
        uint64 creditsTron
    );
    event CreditsReceived(bytes32 guid, uint32 srcEid, bytes message);

    /// ========================== ERRORS =====================================
    error OnlyLpAdminOrOwner();
    error OnlyPlanner();
    error OnlyBurnAndNilifyAdmin();

    error TONComposeNotSupported();
    error InvalidEid();
    error InvalidMsgType(uint16 msgType);
    error InvalidFeeBps(uint16 feeBps);
    error InsufficientFeeBalance();
    error InsufficientCredits(uint32 eid, uint256 credits, uint256 amountWithdraw);
    error InvalidAmount();

    /// ========================== GLOBAL VARIABLE FUNCTIONS =====================================
    function credits(uint32 _eid) external view returns (uint256 credits);
    function lpAdmin() external view returns (address);
    function planner() external view returns (address);
    function burnAndNilifyAdmin() external view returns (address);
    function feeBps() external view returns (uint16);
    function feeBalance() external view returns (uint256);
    function tvl() external view returns (uint256);

    /// ========================== OWNER FUNCTIONS =====================================
    function setLpAdmin(address _lpAdmin) external;
    function setPlanner(address _planner) external;
    function setBurnAndNilifyAdmin(address _burnAndNilifyAdmin) external;
    function setFeeBps(uint16 _feeBps) external;
    function withdrawFees(address _to, uint256 _amount) external;

    /// ========================== BURN AND NILIFY FUNCTIONS =====================================
    function nilify(uint32 _srcEid, bytes32 _sender, uint64 _nonce, bytes32 _payloadHash) external;
    function burn(uint32 _srcEid, bytes32 _sender, uint64 _nonce, bytes32 _payloadHash) external;

    /// ========================== LIQUIDITY FUNCTIONS =====================================
    function depositLocal(uint256 _amount) external;
    function withdrawLocal(address _to, uint256 _amount) external;

    function quoteWithdrawRemote(
        SendParam calldata _sendParam,
        bool _payInLzToken
    ) external view returns (MessagingFee memory msgFee);

    function withdrawRemote(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory msgReceipt);

    /// ========================== CREDIT FUNCTIONS =====================================
    function quoteSendCredits(
        uint32 _dstEid,
        uint64 _creditsArbitrum,
        uint64 _creditsCelo,
        uint64 _creditsEth,
        uint64 _creditsSolana,
        uint64 _creditsTon,
        uint64 _creditsTron,
        bytes calldata _extraOptions,
        bool _payInLzToken
    ) external view returns (MessagingFee memory msgFee);

    function sendCredits(
        uint32 _dstEid,
        uint64 _creditsArbitrum,
        uint64 _creditsCelo,
        uint64 _creditsEth,
        uint64 _creditsSolana,
        uint64 _creditsTon,
        uint64 _creditsTron,
        bytes calldata _extraOptions,
        MessagingFee calldata _fee
    ) external payable returns (MessagingReceipt memory msgReceipt);
}
