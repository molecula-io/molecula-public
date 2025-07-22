// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ValueValidator} from "./../common/ValueValidator.sol";
import {ConstantsCoreV2} from "./Constants.sol";
import {IERC7575} from "./external/interfaces/IERC7575.sol";
import {IIssuer} from "./interfaces/IIssuer.sol";
import {IMoleculaPoolV2} from "./interfaces/IMoleculaPoolV2.sol";
import {IOracleV2} from "./interfaces/IOracleV2.sol";
import {ISupplyManagerV2} from "./interfaces/ISupplyManagerV2.sol";
import {IVaultContainer} from "./Tokens/interfaces/IVaultContainer.sol";
import {ITokenVault} from "./TokenVault/interfaces/ITokenVault.sol";

/// @title Supply Manager V2.
/// @notice Manages the Pool data and handles the deposit and redemption operations.
/// @dev Implements the yield distribution and share management functionality.
contract SupplyManagerV2 is ISupplyManagerV2, Ownable2Step, IOracleV2, ValueValidator {
    //    using Address for address;
    using Address for address payable;

    // ============ Constants ============

    /// @dev https://docs.openzeppelin.com/contracts/5.x/erc4626#defending_with_a_virtual_offset
    ///      `_VIRTUAL_OFFSET` represents a virtual amount of fantom Molecula Tokens and
    ///      shares considered to be initially deposited in an empty `TokenVault`. This is
    ///      used as a mitigation technique against the first depositor price manipulation attacks.
    ///      The virtual tokens and shares are not minted but factored into calculations.
    uint64 internal constant _VIRTUAL_OFFSET = 1e18;

    /// @dev Represents 100% in the full portion calculation (1e18).
    /// Used for precise decimal calculation in yield distribution.
    uint64 internal constant _FULL_PORTION = 1e18;

    // ============ State Variables ============

    /// @dev Molecula Token's address.
    address public immutable MOLECULA_TOKEN;

    /// @notice Molecula Pool contract's interface.
    /// @dev Handles asset deposits and redemptions.
    address internal immutable _MOLECULA_POOL;

    /// @notice Total amount of staking shares in circulation.
    /// @dev Used for calculating share prices and distribution.
    uint256 internal _totalSharesSupply;

    /// @notice Total amount of Molecula Tokens deposited into the Pool.
    /// @dev Represents the base value without yield.
    uint256 public totalDepositedSupply;

    /// @notice Amount of yield shares locked for future distribution.
    /// @dev Accumulates during redemptions and is distributed in batches.
    uint256 public lockedYieldShares;

    /// @notice APY formatter parameter for yield calculation.
    /// @dev (apyFormatter / ConstantsCoreV2.PERCENTAGE_FACTOR) * 100% = percentage retained by mUSD holders.
    uint16 public apyFormatter;

    /// @dev Address authorized to distribute yield.
    address public yieldDistributor;

    /// @dev Mapping of redemption requests to their details.
    mapping(uint256 => RedeemRequestInfo) public redeemRequests;

    /// @dev Validates that the caller is an authorized `TokenVault`.
    modifier onlyTokenVault() {
        IVaultContainer(MOLECULA_TOKEN).validateTokenVault(msg.sender);
        _;
    }

    /**
     * @dev Validate APY.
     * @param apy APY.
     */
    modifier checkApyFormatter(uint256 apy) {
        if (apy > ConstantsCoreV2.PERCENTAGE_FACTOR) {
            revert EInvalidAPY();
        }
        _;
    }

    // ============ Constructor ============

    /// @notice Initializes the Supply Manager's contract.
    /// @param initialOwner Address of the contract's owner.
    /// @param yieldDistributorAddress Address authorized to distribute yield.
    /// @param moleculaPoolAddress Address of the Molecula Pool's contract.
    /// @param apy Initial APY formatter value.
    /// @param moleculaToken_ Molecula Token's contract address.
    /// @dev Sets up the initial state and validates parameters.
    constructor(
        address initialOwner,
        address yieldDistributorAddress,
        address moleculaPoolAddress,
        uint16 apy,
        address moleculaToken_
    )
        Ownable(initialOwner)
        notZeroAddress(yieldDistributorAddress)
        notZeroAddress(moleculaPoolAddress)
        notZeroAddress(moleculaToken_)
        checkApyFormatter(apy)
    {
        _MOLECULA_POOL = moleculaPoolAddress;
        _totalSharesSupply = totalDepositedSupply = _poolSupplyWithOffset();
        apyFormatter = apy;
        yieldDistributor = yieldDistributorAddress;
        MOLECULA_TOKEN = moleculaToken_;
    }

    // ============ Core Deposit/Withdrawal Functions ============

    /// @inheritdoc ISupplyManagerV2
    function deposit(
        address token,
        uint256 requestId,
        uint256 assets
    ) external virtual override onlyTokenVault returns (uint256 shares) {
        // Save the total supply value at the start of the operation.
        uint256 startTotalSupply = getTotalPoolSupply();

        // Call the Molecula Pool to deposit the assets.
        // slither-disable-next-line reentrancy-no-eth,reentrancy-benign
        uint256 moleculaTokenAssets = IMoleculaPoolV2(_MOLECULA_POOL).deposit(
            requestId,
            token,
            msg.sender,
            assets
        );

        shares = _updateDepositData(requestId, assets, startTotalSupply, moleculaTokenAssets);
    }

    /// @inheritdoc ISupplyManagerV2
    function requestRedeem(
        address token,
        address controller,
        address owner,
        uint256 requestId,
        uint256 shares
    ) external virtual override onlyTokenVault returns (uint256 assets) {
        // Ensure that shares can be redeemed.
        if (shares > _totalSharesSupply) {
            revert ENoShares();
        }

        // Check the operation status.
        if (redeemRequests[requestId].state != RequestState.None) {
            revert EUnknownRequest();
        }

        // Get the current total supply.
        uint256 currentTotalSupply = getTotalPoolSupply();

        // Convert shares to the value before applying any changes to the contract values.
        uint256 moleculaTokenAssets = _convert(shares, currentTotalSupply, _totalSharesSupply);

        // Prepare the operation yield variables.
        uint256 operationYield = 0;
        uint256 operationYieldShares = 0;

        // Ensure that the operation has generated yield and lock it if it has.
        if (apyFormatter != 0 && totalDepositedSupply < currentTotalSupply) {
            // Calculate an operation yield value, which can be later distributed as a protocol income.
            // The operation yield must be equal to `actualIncome * (ConstantsCoreV2.PERCENTAGE_FACTOR - apyFormatter)`.
            // The simplified formula: `userIncome / apyFormatter * (ConstantsCoreV2.PERCENTAGE_FACTOR - apyFormatter)`.
            // The detailed formula: `((shares * (totalSupply - totalDepositedSupply)) / _totalSharesSupply) / apyFormatter * (ConstantsCoreV2.PERCENTAGE_FACTOR - apyFormatter)`.
            operationYield =
                (shares *
                    (currentTotalSupply - totalDepositedSupply) *
                    (ConstantsCoreV2.PERCENTAGE_FACTOR - apyFormatter)) /
                (_totalSharesSupply * apyFormatter);

            // Present the operation yield as locked yield shares, which are to be distributed later.
            // slither-disable-next-line divide-before-multiply.
            operationYieldShares = _convert(operationYield, _totalSharesSupply, currentTotalSupply);

            // Update the locked yield shares by increasing it by the operation yield shares' amount.
            lockedYieldShares += operationYieldShares;
        }

        // Decrease the total deposited supply value by the redeemed value.
        totalDepositedSupply -= _convert(shares, totalDepositedSupply, _totalSharesSupply);

        // Increase `totalDepositedSupply` with the operation yield.
        totalDepositedSupply += operationYield;

        // Decrease the total shares' supply amount by the redeemed shares.
        _totalSharesSupply -= shares;

        // Increase the total shares' supply amount with the operation yield shares.
        _totalSharesSupply += operationYieldShares;

        // Make a redeem operation request into the Pool and get a converted value with the right decimal amount.
        // slither-disable-next-line reentrancy-no-eth
        assets = IMoleculaPoolV2(_MOLECULA_POOL).requestRedeem(
            requestId,
            token,
            moleculaTokenAssets
        );

        // Save the redeem operation information.
        redeemRequests[requestId] = RedeemRequestInfo({
            tokenVault: msg.sender,
            state: RequestState.Pending,
            controller: controller,
            owner: owner,
            assets: assets,
            shares: shares
        });

        // Emit the `RedeemRequest` event.
        emit RedeemRequest(requestId, msg.sender, shares, assets);
    }

    /// @inheritdoc ISupplyManagerV2
    // solhint-disable-next-line gas-calldata-parameters
    function fulfillRedeemRequests(
        address assetOwner,
        uint256[] memory requestIds
    ) external virtual override only(_MOLECULA_POOL) returns (address asset, uint256 sumAssets) {
        address tokenVault;
        (tokenVault, sumAssets) = _fulfillRedeemRequests(requestIds);

        // Get the ERC20 token associated with the `TokenVault`.
        asset = IERC7575(tokenVault).asset();
        if (asset == ConstantsCoreV2.NATIVE_TOKEN) {
            revert ENativeToken();
        }

        // Call the `fulfillRedeemRequests` function on `TokenVault`.
        ITokenVault(tokenVault).fulfillRedeemRequests(assetOwner, requestIds, sumAssets);

        emit RedeemRequestsFulfilled(requestIds, sumAssets);
    }

    // ============ Yield Management ============

    /// @inheritdoc ISupplyManagerV2
    function distributeYield(
        Party[] calldata parties,
        uint16 newApyFormatter
    )
        external
        virtual
        override
        only(yieldDistributor)
        checkApyFormatter(newApyFormatter)
        notEmpty(parties.length)
    {
        // Calculate the extra yield to distribute.
        uint256 actualTotalSupply = _poolSupplyWithOffset();
        if (actualTotalSupply <= totalDepositedSupply) {
            revert ENoRealYield();
        }

        uint256 realYield;
        unchecked {
            realYield = actualTotalSupply - totalDepositedSupply;
        }
        uint256 currentYield = (realYield * apyFormatter) / ConstantsCoreV2.PERCENTAGE_FACTOR;
        uint256 extraYield = realYield - currentYield;

        // Find the amount of shares to mint.
        // Note: `totalDepositedSupply + currentYield`  is new total supply.
        uint256 sharesToMint = _convert(
            extraYield,
            _totalSharesSupply,
            totalDepositedSupply + currentYield
        );

        // Find the amount of shares to distribute by adding the locked yield shares' amount.
        uint256 sharesToDistribute = sharesToMint + lockedYieldShares;

        // Distribute the extra yield to the parties.
        uint256 length = parties.length;
        uint256 totalPortion = 0;

        for (uint256 i = 0; i < length; ++i) {
            Party calldata party = parties[i];

            uint256 shares = (party.portion * sharesToDistribute) / _FULL_PORTION;
            totalPortion += party.portion;

            // slither-disable-next-line reentrancy-no-eth
            IIssuer(MOLECULA_TOKEN).mint(party.user, shares);
        }

        // Check that the total portion is equal to `_FULL_PORTION`.
        if (totalPortion != _FULL_PORTION) {
            revert EWrongPortion();
        }

        // Distribute an extra yield by:
        // - Increasing the total shares' supply.
        // - Equating the total deposited and real total supply values.
        _totalSharesSupply += sharesToMint;
        totalDepositedSupply = actualTotalSupply;

        // Reset the locked yield shares' amount.
        lockedYieldShares = 0;

        // Set the new APY formatter.
        apyFormatter = newApyFormatter;

        // Emit the `YieldDistributed` event to log the operation.
        emit YieldDistributed(sharesToDistribute);
    }

    // ============ Admin Functions ============

    /// @inheritdoc ISupplyManagerV2
    function setYieldDistributor(
        address newYieldDistributor
    ) external virtual override onlyOwner notZeroAddress(newYieldDistributor) {
        yieldDistributor = newYieldDistributor;
    }

    // ============ Molecula Token Functions ============

    /// @inheritdoc ISupplyManagerV2
    function onAddTokenVault(address tokenVault) external virtual override only(MOLECULA_TOKEN) {
        IMoleculaPoolV2(_MOLECULA_POOL).addTokenVault(tokenVault);
    }

    /// @inheritdoc ISupplyManagerV2
    function onRemoveTokenVault(address tokenVault) external virtual override only(MOLECULA_TOKEN) {
        IMoleculaPoolV2(_MOLECULA_POOL).removeTokenVault(tokenVault);
    }

    // ============ View Functions ============

    /// @inheritdoc ISupplyManagerV2
    function moleculaToken() external view returns (address moleculaTokenAddress) {
        return MOLECULA_TOKEN;
    }

    /// @inheritdoc ISupplyManagerV2
    function getMoleculaPool() external view virtual override returns (address pool) {
        return _MOLECULA_POOL;
    }

    /// @inheritdoc IOracleV2
    function getTotalPoolSupply() public view virtual override returns (uint256 totalAmount) {
        // Get the Pool's total supply.
        totalAmount = _poolSupplyWithOffset();

        // Reduce the total supply using the APY formatter if needed.
        uint256 _totalDepositedSupply = totalDepositedSupply;
        if (totalAmount > _totalDepositedSupply) {
            // Calculate yield: (totalSupply - totalDeposited) * apyFormatter / APY_FACTOR
            unchecked {
                totalAmount =
                    ((totalAmount - _totalDepositedSupply) * apyFormatter) /
                    ConstantsCoreV2.PERCENTAGE_FACTOR +
                    _totalDepositedSupply;
            }
        }
    }

    /// @inheritdoc IOracleV2
    function getTotalSharesSupply() external view virtual override returns (uint256 shares) {
        return _totalSharesSupply;
    }

    /// @inheritdoc IOracleV2
    function getTotalSupply() public view virtual override returns (uint256 pool, uint256 shares) {
        pool = getTotalPoolSupply();
        shares = _totalSharesSupply;
    }

    /// @inheritdoc IOracleV2
    function convertToShares(
        uint256 assets
    ) external view virtual override returns (uint256 shares) {
        (uint256 pool, uint256 poolShares) = getTotalSupply();
        shares = _convert(assets, poolShares, pool);
    }

    /// @inheritdoc IOracleV2
    function convertToAssets(
        uint256 shares
    ) external view virtual override returns (uint256 assets) {
        (uint256 pool, uint256 poolShares) = getTotalSupply();
        assets = _convert(shares, pool, poolShares);
    }

    // ============ Internal Functions ============

    /// @dev Performs a unit conversion using a ratio.
    /// @param amount Amount to convert.
    /// @param numerator Conversion ratio numerator.
    /// @param denominator Conversion ratio denominator.
    /// @return result Converted amount:
    ///                - If the denominator equals `0`, returns the amount.
    ///                - Otherwise, returns the result of (amount * numerator) / denominator.
    function _convert(
        uint256 amount,
        uint256 numerator,
        uint256 denominator
    ) internal pure virtual returns (uint256 result) {
        result = (amount * numerator) / denominator;
    }

    /// @dev Returns the total supply with a virtual offset added to mitigate the first depositor attacks.
    /// @return Total supply from `_MOLECULA_POOL` and the `_VIRTUAL_OFFSET` constant.
    function _poolSupplyWithOffset() internal view virtual returns (uint256) {
        return IMoleculaPoolV2(_MOLECULA_POOL).totalSupply() + _VIRTUAL_OFFSET;
    }

    /// @dev Internal function to process multiple redeem requests.
    /// @param requestIds Array of request IDs to be fulfilled.
    /// @return tokenVault Address of the `TokenVault` associated with these requests.
    /// @return sumAssets Total sum of assets to be redeemed across all valid requests.
    /// @notice All requests must be from the same `TokenVault` and in the `Pending` state.
    /// @notice Requests in the `Claimable` state are skipped and marked with `0`.
    /// @notice Reverts if no valid pending requests are found or if requests are from different Vaults.
    // solhint-disable-next-line gas-calldata-parameters
    function _fulfillRedeemRequests(
        uint256[] memory requestIds
    ) internal virtual returns (address tokenVault, uint256 sumAssets) {
        // Get `TokenVault` associated with the first request.
        tokenVault = redeemRequests[requestIds[0]].tokenVault;

        // Loop through the remaining requests.
        uint256 length = requestIds.length;
        for (uint256 i = 0; i < length; ++i) {
            RedeemRequestInfo storage redeemRequest = redeemRequests[requestIds[i]];

            // Check if the redeem request is in the `Pending` status and ready to be fulfilled.
            if (redeemRequest.state == RequestState.Pending) {
                // Check whether `TokenVault` is the same for all requests.
                if (redeemRequest.tokenVault != tokenVault) {
                    revert EWrongTokenVault();
                }

                // Add the assets to the total value.
                sumAssets += redeemRequest.assets;

                // Set the status of the current request to `Claimable`.
                redeemRequest.state = RequestState.Claimable;
            } else if (redeemRequest.state == RequestState.None) {
                revert EUnknownRequest();
            } else {
                // Here `redeemRequest.state == RequestState.Claimable`
                // If the request is in the `Claimable` status, it is already confirmed with no need to be processed.
                requestIds[i] = 0;
            }
        }

        // Revert if there are no valid pending requests to fulfill—sum of assets equals zero.
        if (sumAssets == 0) {
            revert ENoPendingRequests();
        }
    }

    /// @dev Updates the internal accounting state after a successful deposit.
    /// @param requestId Deposit request's ID.
    /// @param assets Amount of assets being deposited.
    /// @param startTotalSupply Total supply snapshot taken at the start of deposit.
    /// @param moleculaTokenAssets Amount of Molecula Tokens minted for this deposit.
    /// @return shares Amount of shares minted to represent the deposited assets.
    function _updateDepositData(
        uint256 requestId,
        uint256 assets,
        uint256 startTotalSupply,
        uint256 moleculaTokenAssets
    ) internal virtual returns (uint256 shares) {
        // Calculate the shares' amount to add upon the deposit operation by dividing by the `sharePrice` value.
        shares = _convert(moleculaTokenAssets, _totalSharesSupply, startTotalSupply);

        // Increase the total shares' supply amount.
        _totalSharesSupply += shares;

        // Increase the total deposited supply value.
        totalDepositedSupply += moleculaTokenAssets;

        // Emit the `Deposit` event.
        emit Deposit(requestId, msg.sender, assets, shares);
    }
}
