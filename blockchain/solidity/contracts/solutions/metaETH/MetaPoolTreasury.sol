// SPDX-FileCopyrightText: 2025 Molecula <info@molecula.fi>
// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Guardian} from "./../../common/pausable/Guardian.sol";
import {PriceCheckerClient} from "./../../common/PriceChecker/PriceCheckerClient.sol";
import {ConstantsCoreV2} from "./../../coreV2/Constants.sol";
import {ERC1271} from "./../../coreV2/ERC1271.sol";
import {IERC7575} from "./../../coreV2/external/interfaces/IERC7575.sol";
import {IMoleculaPoolV2} from "./../../coreV2/interfaces/IMoleculaPoolV2.sol";
import {IMoleculaPoolV2WithNativeToken} from "./../../coreV2/interfaces/IMoleculaPoolV2.sol";
import {ISupplyManagerV2WithNative} from "./../../coreV2/interfaces/ISupplyManagerV2.sol";
import {ISupplyManagerV2} from "./../../coreV2/interfaces/ISupplyManagerV2.sol";
import {VaultContainer} from "./../../coreV2/Tokens/VaultContainer.sol";
import {IBaseTokenVault} from "./../../coreV2/TokenVault/interfaces/ITokenVault.sol";
import {WhitelistedExecutor} from "./../../coreV2/WhitelistedExecutor.sol";
import {IMetaPoolTreasury} from "./interfaces/IMetaPoolTreasury.sol";
import {PausableExecute} from "./PausableExecute.sol";
import {PausableFulfillRedeemRequests} from "./PausableFulfillRedeem.sol";

/// @notice MetaPoolTreasury
contract MetaPoolTreasury is
    IMetaPoolTreasury,
    IMoleculaPoolV2,
    IMoleculaPoolV2WithNativeToken,
    WhitelistedExecutor,
    ERC1271,
    Ownable2Step,
    PausableExecute,
    PausableFulfillRedeemRequests,
    PriceCheckerClient
{
    using SafeERC20 for IERC20;
    using Address for address payable;

    // ============ State Variables ============

    /// @dev Supply Manager's address.
    address public immutable SUPPLY_MANAGER;

    /// @dev Pool Keeper's address.
    address public poolKeeper;

    /// @dev Pool of all the supported tokens including the ones of the ERC20 types.
    address[] internal _pool;

    /// @dev Mapping of the ERC20 Pool.
    mapping(address token => TokenInfo) public poolMap;

    // ============ Modifiers ============

    /// @dev Modifier that checks if a token exists in the pool.
    /// @param token Token address to check.
    modifier tokenIsPresent(address token) {
        if (!poolMap[token].isPresent) {
            revert ETokenNotExist();
        }
        _;
    }

    /// @dev Modifier that checks if a address is not blocked.
    /// @param token Token address to check.
    modifier tokenIsNotBlocked(address token) {
        if (poolMap[token].isBlocked) {
            revert ETokenBlocked();
        }
        _;
    }

    // ============ Constructor ============

    /**
     * @dev Initializes the contract setting the initializer address.
     * @param initialOwner Owner's address.
     * @param poolKeeperAddress Pool Keeper's address.
     * @param supplyManagerAddress Supply Manager's address.
     * @param whiteList List of whitelisted addresses.
     * @param guardianAddress Guardian address that can pause the contract.
     * @param priceChecker_ Price checker contract's address.
     * @param signer_ Initial signer address for the ERC1271 validation.
     */
    constructor(
        address initialOwner,
        address poolKeeperAddress,
        address supplyManagerAddress,
        WhiteList[] memory whiteList,
        address guardianAddress,
        address priceChecker_,
        address signer_
    )
        Ownable(initialOwner)
        Guardian(guardianAddress)
        PriceCheckerClient(priceChecker_)
        ERC1271(signer_)
        WhitelistedExecutor(whiteList)
        notZeroAddress(poolKeeperAddress)
        notZeroAddress(supplyManagerAddress)
    {
        poolKeeper = poolKeeperAddress;
        SUPPLY_MANAGER = supplyManagerAddress;
    }

    // ============ Anybody's Functions ============

    /// @dev Allows the contract to receive ETH.
    receive() external payable virtual {}

    /// @inheritdoc IMetaPoolTreasury
    function fulfillRedeemRequests(
        uint256[] calldata requestIds
    )
        external
        virtual
        override
        notEmpty(requestIds.length)
        checkNotPause(_FULFILL_REDEEM_REQUESTS_SELECTOR)
    {
        // Receive the corresponding ERC20 token and total assets redeemed.
        // Note: `assets` is in the token amount (e.g. sUSDe).
        // slither-disable-next-line reentrancy-benign
        (address token, uint256 assets) = ISupplyManagerV2(SUPPLY_MANAGER).fulfillRedeemRequests(
            address(this),
            requestIds
        );

        _checkTokenAndDecreaseRedeemAssets(token, assets);
    }

    /// @inheritdoc IMetaPoolTreasury
    function fulfillRedeemRequestsForNativeToken(
        uint256[] calldata requestIds
    )
        external
        virtual
        override
        notEmpty(requestIds.length)
        checkNotPause(_FULFILL_REDEEM_REQUESTS_SELECTOR)
    {
        // Receive the corresponding native token and total value redeemed.
        // Note: `value` is in the native token amount (e.g. ETH).
        // slither-disable-next-line reentrancy-benign
        (address token, uint256 value) = ISupplyManagerV2WithNative(SUPPLY_MANAGER)
            .fulfillRedeemRequestsForNativeToken(requestIds);

        _checkTokenAndDecreaseRedeemAssets(token, value);
    }

    // ============ Supply Manager's Functions ============

    /// @inheritdoc IMoleculaPoolV2
    function deposit(
        uint256 /*requestId*/,
        address token,
        address tokenVault,
        uint256 assets
    )
        external
        virtual
        override
        only(SUPPLY_MANAGER)
        tokenIsPresent(token)
        returns (uint256 moleculaTokenAssets)
    {
        // Transfer assets to the token holder.
        // slither-disable-next-line arbitrary-send-erc20
        IERC20(token).safeTransferFrom(tokenVault, address(this), assets);

        moleculaTokenAssets = IBaseTokenVault(tokenVault).convertAssetsToMoleculaAssets(assets);
    }

    /// @inheritdoc IMoleculaPoolV2WithNativeToken
    function depositNativeToken(
        uint256 /*requestId*/,
        address token,
        address tokenVault,
        uint256 /*assets*/
    )
        external
        payable
        virtual
        override
        only(SUPPLY_MANAGER)
        tokenIsPresent(token)
        returns (uint256 moleculaTokenAssets)
    {
        moleculaTokenAssets = IBaseTokenVault(tokenVault).convertAssetsToMoleculaAssets(msg.value);
    }

    /// @inheritdoc IMoleculaPoolV2
    function requestRedeem(
        uint256 /*requestId*/,
        address token,
        address tokenVault,
        uint256 moleculaTokenAssets
    )
        external
        virtual
        override
        only(SUPPLY_MANAGER)
        tokenIsPresent(token)
        returns (uint256 assets)
    {
        assets = IBaseTokenVault(tokenVault).convertMoleculaAssetsToAssets(moleculaTokenAssets);

        // Must reduce the Pool amount to correctly calculate `totalSupply` upon redemption.
        poolMap[token].requestedRedeemAssets += assets;

        if (token != ConstantsCoreV2.NATIVE_TOKEN) {
            // Increase the MetaPoolTreasury's allowance toward `tokenVault` by `assets`.
            IERC20(token).safeIncreaseAllowance(tokenVault, assets);
        }
    }

    /// @inheritdoc IMoleculaPoolV2WithNativeToken
    function grantNativeToken(
        address receiver,
        uint256 nativeTokenAmount
    ) external virtual override only(SUPPLY_MANAGER) {
        payable(receiver).sendValue(nativeTokenAmount);
    }

    /// @inheritdoc IMoleculaPoolV2
    function addTokenVault(address tokenVault) external virtual override only(SUPPLY_MANAGER) {
        address asset = IERC7575(tokenVault).asset();
        _addToken(asset);
    }

    /// @inheritdoc IMoleculaPoolV2
    function removeTokenVault(address tokenVault) external virtual override only(SUPPLY_MANAGER) {
        address asset = IERC7575(tokenVault).asset();
        if (poolMap[asset].isPresent) {
            _removeToken(asset);
        }
    }

    // ============ Owner's Functions ============

    /// @inheritdoc IMetaPoolTreasury
    function addToken(address token) external virtual override onlyOwner {
        _addToken(token);
    }

    /// @inheritdoc IMetaPoolTreasury
    function removeToken(address token) external virtual override onlyOwner tokenIsPresent(token) {
        _removeToken(token);
    }

    /// @inheritdoc IMetaPoolTreasury
    function setPoolKeeper(
        address poolKeeperAddress
    ) external virtual override onlyOwner notZeroAddress(poolKeeperAddress) {
        address oldKeeper = poolKeeper;
        poolKeeper = poolKeeperAddress;
        emit PoolKeeperChanged(oldKeeper, poolKeeperAddress);
    }

    /// @inheritdoc IMetaPoolTreasury
    function setBlockToken(address token, bool isBlocked) external virtual override onlyOwner {
        TokenInfo storage tokenInfo = poolMap[token];
        if (!tokenInfo.isPresent) {
            revert ETokenNotExist();
        }
        if (tokenInfo.isBlocked == isBlocked) {
            revert EAlreadyBlockedSet();
        }

        tokenInfo.isBlocked = isBlocked;
        emit TokenBlockedChanged(token, isBlocked);
    }

    /// @inheritdoc PriceCheckerClient
    function setPriceChecker(address newPriceChecker) public virtual override {
        super.setPriceChecker(newPriceChecker);

        // Validates that the price checker is properly set for each asset.
        uint256 len = _pool.length;
        for (uint256 i = 0; i < len; ++i) {
            address token = _pool[i];
            _validatePriceChecker(token);
        }
    }

    /// @inheritdoc Ownable2Step
    function transferOwnership(address newOwner) public virtual override(Ownable, Ownable2Step) {
        // Initiate ownership transfer.
        super.transferOwnership(newOwner);
    }

    // ============ PoolKeeper's Functions ============

    /// @inheritdoc IMetaPoolTreasury
    function execute(
        ExecuteParams[] calldata params,
        TransactionValueType valueMode
    )
        external
        payable
        virtual
        override
        only(poolKeeper)
        checkNotPause(_EXECUTE_SELECTOR)
        returns (bytes[] memory result)
    {
        uint256 length = params.length;
        result = new bytes[](length);
        uint256 sentValue = 0;
        for (uint256 i = 0; i < length; ++i) {
            ExecuteParams calldata param = params[i];
            sentValue += param.value;
            result[i] = _execute(param.target, param.data, param.value);
        }

        if (valueMode == TransactionValueType.USE_MESSAGE_VALUE) {
            // Use only the attached `msg.value`.
            // `sentValue` must be taken from the `msg.value`.
            if (msg.value != sentValue) {
                revert EWrongMsgValue();
            }
        } else if (valueMode == TransactionValueType.USE_POOL_BALANCE) {
            // Use only the Pool's ETH balance.
            // `sentValue` must be taken from the contract's balance. Ensure `msg.value` is zero.
            if (msg.value != 0) {
                revert EMsgValueIsNotZero();
            }
        } else {
            // Use both msg.value and pool's balance.
            // `sentValue` must be taken from the contract's balance and `msg.value`. If we sent
            //  some value, ensure that `msg.value` != 0. Otherwise, use the `USE_POOL_BALANCE` mode.
            if (msg.value == 0 && sentValue != 0) {
                revert EWrongMsgValue();
            }
        }

        emit Executed(result);
    }

    // ============ View Functions ============

    /// @inheritdoc IMetaPoolTreasury
    function totalPoolsSupplyAndRedeem(
        bool doCheckPrice
    ) public view virtual override returns (uint256 totalMoleculaAssets, uint256 totalRedeem) {
        uint256 len = _pool.length;
        for (uint256 i = 0; i < len; ++i) {
            // Get the token address.
            address token = _pool[i];

            if (doCheckPrice) {
                // If a price feed is set for the token, then check that the token price is within the allowed deviation.
                // If the price feed is not set but asset is present, do nothing.
                // Otherwise, throw an exception.
                checkPrice(token);
            }

            // Get the Vault associated with the token.
            IBaseTokenVault tokenVault = IBaseTokenVault(_getTokenVault(token));

            // Get the token balance.
            uint256 assets = token == ConstantsCoreV2.NATIVE_TOKEN
                ? address(this).balance
                : IERC20(token).balanceOf(address(this));

            // Increase the total available asset balance.
            totalMoleculaAssets += tokenVault.convertAssetsToMoleculaAssets(assets);

            // Increase the total asset balance to redeem.
            totalRedeem += tokenVault.convertAssetsToMoleculaAssets(
                poolMap[token].requestedRedeemAssets
            );
        }
    }

    /// @inheritdoc IMoleculaPoolV2
    function totalSupply() public view virtual override returns (uint256 totalPool) {
        totalPool = _totalSupply(false);
    }

    /// @inheritdoc IMoleculaPoolV2
    function validatedTotalSupply() public view virtual override returns (uint256 totalPool) {
        totalPool = _totalSupply(true);
    }

    /// @inheritdoc IMetaPoolTreasury
    function getTokenPool() external view virtual override returns (address[] memory result) {
        return _pool;
    }

    // ============ Internal Functions ============

    /// @inheritdoc Ownable2Step
    function _transferOwnership(address newOwner) internal virtual override(Ownable, Ownable2Step) {
        // Transfer ownership to the new Owner.
        super._transferOwnership(newOwner);
    }

    /// @dev Add the token to the Pool.
    /// @param token ERC20 token address.
    function _addToken(address token) internal virtual {
        // Validates that the price checker is properly set for the asset.
        _validatePriceChecker(token);

        // Ensure that the token is not duplicated.
        if (poolMap[token].isPresent) {
            revert EDuplicatedToken();
        }

        // Check that tokenVault exists.
        _getTokenVault(token);

        _pool.push(token);
        poolMap[token] = TokenInfo({
            isPresent: true,
            arrayIndex: uint32(_pool.length - 1),
            requestedRedeemAssets: 0,
            isBlocked: false
        });

        emit TokenAdded(token);
    }

    /// @dev Removes a token from the Pool and transfers the remaining balance to the owner.
    /// @param token Address of the token to remove.
    /// @notice Checks for pending redemptions and handles the remaining token balance.
    function _removeToken(address token) internal virtual {
        // Check if the token has pending redemptions.
        if (poolMap[token].requestedRedeemAssets > 0) {
            revert ENotZeroValueToRedeemOfRemovedToken();
        }

        // Remove the token from the Pool array and update the mappings.
        uint32 i = poolMap[token].arrayIndex;
        address lastElement = _pool[_pool.length - 1];
        _pool[i] = lastElement;
        poolMap[lastElement].arrayIndex = i;
        delete poolMap[token];
        _pool.pop();

        // Get the token balance and transfer to the Owner.
        if (token == ConstantsCoreV2.NATIVE_TOKEN) {
            uint256 balance = address(this).balance;
            if (balance > 0) {
                // slither-disable-next-line arbitrary-send-eth,low-level-calls
                (bool success, bytes memory returnData) = owner().call{value: balance}("");
                if (!success) {
                    emit EthTransferFailed(returnData);
                }
            }
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                // Transfer the remaining balance to the Owner.
                IERC20(token).safeTransfer(owner(), balance);
            }
        }

        emit TokenRemoved(token);
    }

    /// @inheritdoc WhitelistedExecutor
    function _execute(
        address target,
        bytes calldata data,
        uint256 value
    ) internal virtual override tokenIsNotBlocked(target) returns (bytes memory result) {
        return super._execute(target, data, value);
    }

    /// @dev Gets the Token Vault's address for a token.
    /// @param token Token address.
    /// @return vault Token Vault's address.
    function _getTokenVault(address token) internal view virtual returns (address vault) {
        address moleculaToken = ISupplyManagerV2(SUPPLY_MANAGER).moleculaToken();

        // Note: `VaultContainer` throws an exception if there is no Vault for the token.
        vault = VaultContainer(moleculaToken).vault(token);
    }

    /// @dev Check that token is in the Pool and not blocked. Decrease redeem assets for the token.
    /// @param token Token address.
    /// @param assets Assets amount.
    function _checkTokenAndDecreaseRedeemAssets(
        address token,
        uint256 assets
    ) internal virtual tokenIsPresent(token) tokenIsNotBlocked(token) {
        // Reduce the assets to redeem for the correct `totalSupply` calculation.
        poolMap[token].requestedRedeemAssets -= assets;
    }

    /// @dev Returns the total supply of the Pool (TVL).
    /// @param doCheckPrice Boolean flag indicating whether to perform price checks during calculation.
    /// @return totalPool Total pool supply.
    function _totalSupply(bool doCheckPrice) internal view virtual returns (uint256 totalPool) {
        (uint256 totalMoleculaAssets, uint256 totalRedeem) = totalPoolsSupplyAndRedeem(
            doCheckPrice
        );
        if (totalRedeem < totalMoleculaAssets) {
            unchecked {
                totalPool = totalMoleculaAssets - totalRedeem;
            }
        }
    }

    /// @inheritdoc WhitelistedExecutor
    function _isAllowedForApprove(
        address target
    ) internal virtual override returns (bool isAllowed) {
        isAllowed = poolMap[target].isPresent;
    }
}
