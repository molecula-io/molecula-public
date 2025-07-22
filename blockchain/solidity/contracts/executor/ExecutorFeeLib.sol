// SPDX-License-Identifier: LZBL-1.2
// copied and modified from https://github.com/LayerZero-Labs/LayerZero-v2/blob/main/packages/layerzero-v2/evm/messagelib/contracts/ExecutorFeeLib.sol
pragma solidity ^0.8.24;

import {IExecutor} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/interfaces/IExecutor.sol";
import {IExecutorFeeLib} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/interfaces/IExecutorFeeLib.sol";
import {ILayerZeroPriceFeed} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/interfaces/ILayerZeroPriceFeed.sol";
import {ExecutorOptions} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/libs/ExecutorOptions.sol";
import {Transfer} from "@layerzerolabs/lz-evm-protocol-v2/contracts/libs/Transfer.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ExecutorFeeLib
 * @dev Library contract for dynamic fee calculation in the LayerZeroV2.
 *      Handles pricing based on calldata size, gas cost, price feeds, protocol margin,
 *      and protocol upgrades. Pluggable into Executor contracts for flexible fee policy.
 */
contract ExecutorFeeLib is Ownable, IExecutorFeeLib {
    using ExecutorOptions for bytes;

    /// @dev Conversion rate for native token decimals (e.g., 1e18 for ETH).
    uint256 private immutable _NATIVE_DECIMALS_RATE;

    /// @dev Local endpoint ID (LayerZero V2 context only, for read calls).
    uint32 private immutable _LOCAL_EID_V2;

    /**
     * @dev Initialize fee library with local endpoint and native decimals rate.
     * @param localEidV2 Local endpoint ID (used for read mode).
     * @param nativeDecimalsRate Native token decimal scaling factor (usually 1e18).
     */
    constructor(uint32 localEidV2, uint256 nativeDecimalsRate) Ownable(msg.sender) {
        _LOCAL_EID_V2 = localEidV2;
        _NATIVE_DECIMALS_RATE = nativeDecimalsRate;
    }

    // ================================ OnlyOwner ================================
    /**
     * @dev Allows owner to withdraw ERC20 tokens or native tokens held by this contract.
     *      If _token is address(0), will transfer native balance.
     * @param _token ERC20 address or zero for native token.
     * @param _to Receiver address.
     * @param _amount Amount to transfer.
     */
    function withdrawToken(address _token, address _to, uint256 _amount) external onlyOwner {
        // transfers native if _token is address(0x0)
        Transfer.nativeOrToken(_token, _to, _amount);
    }

    // ================================ External ================================
    /**
     * @dev Calculate fee for sending (write mode), proxy for getFee.
     * @param _params Fee parameter struct, including priceFeed and defaultMultiplierBps.
     * @param _dstConfig Per-endpoint config (gas, cap, margin, etc.).
     * @param _options ABI-encoded ExecutorOptions (defines gas, value, etc.).
     * @return fee Total fee in native token.
     */
    function getFeeOnSend(
        FeeParams calldata _params,
        IExecutor.DstConfig calldata _dstConfig,
        bytes calldata _options
    ) external view returns (uint256 fee) {
        fee = getFee(_params, _dstConfig, _options);
    }

    /**
     * @dev Calculate fee for sending (read mode), proxy for getFee.
     * @param _params Fee parameter struct for "read" (local) jobs.
     * @param _dstConfig Per-endpoint config for the local endpoint.
     * @param _options ABI-encoded ExecutorOptions.
     * @return fee Total fee in native token.
     */
    function getFeeOnSend(
        FeeParamsForRead calldata _params,
        IExecutor.DstConfig calldata _dstConfig,
        bytes calldata _options
    ) external view returns (uint256 fee) {
        fee = getFee(_params, _dstConfig, _options);
    }

    // ================================ View ================================

    /**
     * @dev Compute required fee for a "send" (write) job using full parameter set.
     *      Reverts if destination endpoint is not supported.
     * @param _params Fee parameter struct (price feed, dstEid, sender, calldata size, default multiplier).
     * @param _dstConfig Destination config (base gas, premium, margin, native cap, etc).
     * @param _options ABI-encoded ExecutorOptions.
     * @return fee Computed total fee in native tokens.
     */
    function getFee(
        FeeParams calldata _params,
        IExecutor.DstConfig calldata _dstConfig,
        bytes calldata _options
    ) public view returns (uint256 fee) {
        // If base gas is zero, this eid is not supported
        if (_dstConfig.lzReceiveBaseGas == 0) revert Executor_EidNotSupported(_params.dstEid);

        // Decode options: computes total value, total gas, and ignores calldata size for this mode
        (uint256 totalValue, uint256 totalGas, ) = _decodeExecutorOptions(
            false,
            _isV1Eid(_params.dstEid),
            _dstConfig.lzReceiveBaseGas,
            _dstConfig.lzComposeBaseGas,
            _dstConfig.nativeCap,
            _options
        );

        // Query price feed: returns required gas fee, price ratio, and USD price for native
        (
            uint256 totalGasFee,
            uint128 priceRatio,
            uint128 priceRatioDenominator,
            uint128 nativePriceUSD
        ) = ILayerZeroPriceFeed(_params.priceFeed).estimateFeeByEid(
                _params.dstEid,
                _params.calldataSize,
                totalGas
            );

        // Use dstConfig's multiplier if present, else use default from params
        uint16 multiplierBps = _dstConfig.multiplierBps == 0
            ? _params.defaultMultiplierBps
            : _dstConfig.multiplierBps;

        // Add premium and margin to gas fee, ensuring minimum margin in USD if needed
        fee = _applyPremiumToGas(
            totalGasFee,
            multiplierBps,
            _dstConfig.floorMarginUSD,
            nativePriceUSD
        );
        // Add premium on value transfer (for value-based jobs)
        fee += _convertAndApplyPremiumToValue(
            totalValue,
            priceRatio,
            priceRatioDenominator,
            multiplierBps
        );
    }

    /**
     * @dev Compute required fee for a "read" (local) job using _localEidV2 context.
     *      Reverts if base gas is zero.
     * @param _params Fee parameter struct for read-only jobs.
     * @param _dstConfig Config for the local endpoint.
     * @param _options ABI-encoded ExecutorOptions.
     * @return fee Computed total fee in native tokens.
     */
    function getFee(
        FeeParamsForRead calldata _params,
        IExecutor.DstConfig calldata _dstConfig,
        bytes calldata _options
    ) public view returns (uint256 fee) {
        if (_dstConfig.lzReceiveBaseGas == 0) revert Executor_EidNotSupported(_LOCAL_EID_V2);

        (uint256 totalValue, uint256 totalGas, uint32 calldataSize) = _decodeExecutorOptions(
            true,
            false, // endpoint v2 only
            _dstConfig.lzReceiveBaseGas,
            _dstConfig.lzComposeBaseGas,
            _dstConfig.nativeCap,
            _options
        );

        (
            uint256 totalGasFee,
            uint128 priceRatio,
            uint128 priceRatioDenominator,
            uint128 nativePriceUSD
        ) = ILayerZeroPriceFeed(_params.priceFeed).estimateFeeByEid(
                _LOCAL_EID_V2,
                calldataSize,
                totalGas
            );

        // Use dstConfig's multiplier if present, else use default from params
        uint16 multiplierBps = _dstConfig.multiplierBps == 0
            ? _params.defaultMultiplierBps
            : _dstConfig.multiplierBps;

        // Add premium and margin to gas fee, ensuring minimum margin in USD if needed
        fee = _applyPremiumToGas(
            totalGasFee,
            multiplierBps,
            _dstConfig.floorMarginUSD,
            nativePriceUSD
        );
        // Add premium on value transfer (for value-based jobs)
        fee += _convertAndApplyPremiumToValue(
            totalValue,
            priceRatio,
            priceRatioDenominator,
            multiplierBps
        );
    }

    // ================================ Internal ================================
    /**
     * @dev Parse ExecutorOptions and aggregate total value and gas required for a message.
     *      Reverts if any option is unsupported in the current context.
     * @param _isRead True if being used in a "read" job context (enforces stricter checks).
     * @param _v1Eid True if destination endpoint is v1.
     * @param _lzReceiveBaseGas Baseline gas required for receive.
     * @param _lzComposeBaseGas Baseline gas per compose call.
     * @param _nativeCap Max value that can be transferred.
     * @param _options ABI-encoded ExecutorOptions.
     * @return totalValue Sum of all values to transfer with this message.
     * @return totalGas Total gas required for all steps (includes receive/compose).
     * @return calldataSize Total calldata size, for pricing read calls.
     */
    function _decodeExecutorOptions(
        bool _isRead,
        bool _v1Eid,
        uint64 _lzReceiveBaseGas,
        uint64 _lzComposeBaseGas,
        uint128 _nativeCap,
        bytes calldata _options
    ) internal pure returns (uint256 totalValue, uint256 totalGas, uint32 calldataSize) {
        // Parse and aggregate options into struct
        ExecutorOptionsAgg memory aggOptions = _parseExecutorOptions(
            _options,
            _isRead,
            _v1Eid,
            _nativeCap
        );
        totalValue = aggOptions.totalValue;
        calldataSize = aggOptions.calldataSize;

        // Add required base gas for receive (always called once)
        totalGas = _lzReceiveBaseGas + aggOptions.totalGas;
        // For each compose option, add base gas for compose (multi-packet messages)
        totalGas += _lzComposeBaseGas * aggOptions.numLzCompose;
        // If the job is marked "ordered", bump gas by 2%
        if (aggOptions.ordered) {
            totalGas = (totalGas * 102) / 100;
        }
    }

    /**
     * @dev
     * Aggregated decoded values from the parsed ExecutorOptions array.
     * This struct is used internally to collect and summarize all relevant parameters
     * that affect fee and gas calculation for a LayerZero job. It captures native value,
     * gas, calldata size, and flags set by the various ExecutorOptions.
     *
     * @param totalValue      Total native tokens required to be sent for all options (including drops and value-based executions).
     * @param totalGas        Sum of gas required by all LZ options (excluding base gas, which is added later).
     * @param ordered         True if ordered execution is requested (affects fee/gas calculation by increasing gas).
     * @param calldataSize    Aggregate calldata size required (used only for read jobs).
     * @param numLzCompose    Number of LZCompose options present (each adds base gas for a compose call).
     */
    struct ExecutorOptionsAgg {
        uint256 totalValue;
        uint256 totalGas;
        bool ordered;
        uint32 calldataSize;
        uint256 numLzCompose;
    }

    /**
     * @dev Helper: parse and validate options for all supported option types.
     *      Enforces context-specific rules for option usage (read/write, v1/v2).
     * @param _options ABI-encoded ExecutorOptions.
     * @param _isRead True for read jobs (CmdLib).
     * @param _v1Eid True for v1 endpoint jobs (limited option support).
     * @param _nativeCap Native token cap for value-based options.
     * @return options Parsed and validated aggregate options.
     */
    // slither-disable-next-line cyclomatic-complexity
    function _parseExecutorOptions(
        bytes calldata _options,
        bool _isRead,
        bool _v1Eid,
        uint128 _nativeCap
    ) internal pure returns (ExecutorOptionsAgg memory options) {
        uint256 optionsLength = _options.length;
        if (optionsLength == 0) {
            revert Executor_NoOptions();
        }

        uint256 cursor = 0;
        uint256 lzReceiveGas = 0;
        uint32 calldataSize = 0;
        // Iterate through all encoded option segments
        while (cursor < optionsLength) {
            (uint8 optionType, bytes calldata option, uint256 newCursor) = _options
                .nextExecutorOption(cursor);
            cursor = newCursor;

            // Handle each option type by id
            if (optionType == ExecutorOptions.OPTION_TYPE_LZRECEIVE) {
                // "read" mode does not allow LZRECEIVE option
                if (_isRead) revert Executor_UnsupportedOptionType(optionType);
                (uint128 gas, uint128 value) = ExecutorOptions.decodeLzReceiveOption(option);

                // v1 endpoints do not support receive+value
                if (_v1Eid && value > 0) revert Executor_UnsupportedOptionType(optionType);

                options.totalValue += value;
                lzReceiveGas += gas;
            } else if (optionType == ExecutorOptions.OPTION_TYPE_NATIVE_DROP) {
                // "read" mode does not allow nativeDrop option
                if (_isRead) revert Executor_UnsupportedOptionType(optionType);
                // slither-disable-next-line unused-return
                (uint128 nativeDropAmount, ) = ExecutorOptions.decodeNativeDropOption(option);
                options.totalValue += nativeDropAmount;
            } else if (optionType == ExecutorOptions.OPTION_TYPE_LZCOMPOSE) {
                // v1 endpoints do not support compose at all
                if (_v1Eid) revert Executor_UnsupportedOptionType(optionType);
                // slither-disable-next-line unused-return
                (, uint128 gas, uint128 value) = ExecutorOptions.decodeLzComposeOption(option);
                if (gas == 0) revert Executor_ZeroLzComposeGasProvided();

                options.totalValue += value;
                options.totalGas += gas;
                ++options.numLzCompose;
            } else if (optionType == ExecutorOptions.OPTION_TYPE_ORDERED_EXECUTION) {
                // Special flag for ordered execution (affects gas calc)
                options.ordered = true;
            } else if (optionType == ExecutorOptions.OPTION_TYPE_LZREAD) {
                // Only valid in "read" context
                if (!_isRead) revert Executor_UnsupportedOptionType(optionType);

                (uint128 gas, uint32 size, uint128 value) = ExecutorOptions.decodeLzReadOption(
                    option
                );
                options.totalValue += value;
                lzReceiveGas += gas;
                calldataSize += size;
            } else {
                revert Executor_UnsupportedOptionType(optionType);
            }
        }
        // If parser did not end at the right offset, data is malformed
        if (cursor != _options.length) revert Executor_InvalidExecutorOptions(cursor);
        // Value transfer cannot exceed native cap (prevents griefing)
        if (options.totalValue > _nativeCap)
            revert Executor_NativeAmountExceedsCap(options.totalValue, _nativeCap);
        // Must specify at least some receive gas
        if (lzReceiveGas == 0) revert Executor_ZeroLzReceiveGasProvided();
        // For read, must specify nonzero calldata
        if (_isRead && calldataSize == 0) revert Executor_ZeroCalldataSizeProvided();
        options.totalGas += lzReceiveGas;
        options.calldataSize = calldataSize;
    }

    /**
     * @dev Add a premium/margin to the gas fee. If a minimum margin is required (in USD),
     *      ensure the result is not less than that margin. Always uses _nativeDecimalsRate.
     * @param _fee Base gas fee in native token.
     * @param _multiplierBps Premium to apply, in basis points.
     * @param _marginUSD Minimum required margin (in USD, 8 decimals).
     * @param _nativePriceUSD Price of 1 native token in USD (8 decimals).
     * @return feeWithPremium Adjusted fee including premium and enforced margin.
     */
    function _applyPremiumToGas(
        uint256 _fee,
        uint16 _multiplierBps,
        uint128 _marginUSD,
        uint128 _nativePriceUSD
    ) internal view returns (uint256) {
        // Apply multiplier first
        uint256 feeWithMultiplier = (_fee * _multiplierBps) / 10000;

        // If no margin or price data, use multiplier result
        if (_nativePriceUSD == 0 || _marginUSD == 0) {
            return feeWithMultiplier;
        }
        // Compute fee with minimum enforced USD margin, scaled to native decimals
        uint256 feeWithMargin = (_marginUSD * _NATIVE_DECIMALS_RATE) / _nativePriceUSD + _fee;
        // Return the greater of the margin or the multiplier premium
        return feeWithMargin > feeWithMultiplier ? feeWithMargin : feeWithMultiplier;
    }

    /**
     * @dev Apply premium to value transfer component of the fee (for value-based jobs).
     *      Converts value using price ratio, then applies premium.
     * @param _value Total value to send with job (native).
     * @param _ratio Price feed ratio for the conversion.
     * @param _denom Denominator for price ratio.
     * @param _multiplierBps Premium, in basis points.
     * @return fee Premium-adjusted value fee.
     */
    function _convertAndApplyPremiumToValue(
        uint256 _value,
        uint128 _ratio,
        uint128 _denom,
        uint16 _multiplierBps
    ) internal pure returns (uint256 fee) {
        if (_value > 0) {
            // Convert, then apply premium
            // slither-disable-next-line divide-before-multiply
            fee = (((_value * _ratio) / _denom) * _multiplierBps) / 10000;
        }
    }

    /**
     * @dev Helper to determine if a given endpoint ID is a v1 endpoint (legacy support).
     * @param _eid Endpoint ID.
     * @return True if v1 endpoint, false otherwise.
     */
    function _isV1Eid(uint32 _eid) internal pure virtual returns (bool) {
        // v1 endpoint IDs are all < 30000 by convention
        return _eid < 30000;
    }

    /**
     * @dev Return semantic version of this fee library contract.
     * @return major Major version number.
     * @return minor Minor version number.
     */
    function version() external pure returns (uint64 major, uint8 minor) {
        return (1, 1);
    }

    /**
     * @dev Allow contract to receive native token (to pay for price feed).
     */
    receive() external payable {}
}
