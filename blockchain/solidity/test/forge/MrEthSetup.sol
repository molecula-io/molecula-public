// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DepositManager} from "../../contracts/solutions/mrETH/DepositManager.sol";
import {DepositManagerStorage} from "../../contracts/solutions/mrETH/DepositManagerStorage.sol";
import {IDepositManagerTypes} from "../../contracts/solutions/mrETH/interfaces/IDepositManagerTypes.sol";
import {IStrategyLib} from "../../contracts/solutions/mrETH/interfaces/IStrategyLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AaveBufferLib} from "../../contracts/solutions/mrETH/libraries/AaveBufferLib.sol";
import {CompoundBufferLib} from "../../contracts/solutions/mrETH/libraries/CompoundBufferLib.sol";
import {IDelegationManager, IStrategy} from "../../contracts/solutions/mrETH/external/interfaces/IDelegationManager.sol";
import {ISignatureUtilsMixinTypes} from "../../contracts/solutions/mrETH/external/interfaces/ISignatureUtilsMixin.sol";
import {IWETH} from "../../contracts/solutions/mrETH/external/interfaces/IWETH.sol";
import {ISupplyManagerV2} from "../../contracts/coreV2/interfaces/ISupplyManagerV2.sol";
import {IStrategyFactory} from "../../contracts/solutions/mrETH/external/interfaces/IStrategyFactory.sol";
import {Delegator} from "../../contracts/solutions/mrETH/Delegator.sol";
import {SupplyManagerV2WithNative} from "../../contracts/coreV2/SupplyManagerV2WithNative.sol";
import {RebaseTokenV2} from "../../contracts/coreV2/Tokens/RebaseTokenV2.sol";
import {MrEthAssetTokenVault} from "../../contracts/solutions/mrETH/TokenVault/MrEthAssetTokenVault.sol";
import {MrEthNativeTokenVault} from "../../contracts/solutions/mrETH/TokenVault/MrEthNativeTokenVault.sol";
import {IMoleculaPoolV2} from "../../contracts/coreV2/interfaces/IMoleculaPoolV2.sol";
import {IBufferInteractor} from "../../contracts/solutions/mrETH/interfaces/IBufferInteractor.sol";
import {ConstantsCoreV2} from "../../contracts/coreV2/Constants.sol";
import {AaveBufferLib} from "../../contracts/solutions/mrETH/libraries/AaveBufferLib.sol";
import {CompoundBufferLib} from "../../contracts/solutions/mrETH/libraries/CompoundBufferLib.sol";

interface ILido is IERC20 {
    function getTotalPooledEther() external view returns (uint256);
    function getTotalShares() external view returns (uint256);

    function submit(address _referral) external payable returns (uint256);
    function nonces(address _user) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/**
 * @title Aave Buffer Interactor
 * @notice Wrapper contract that implements IBufferInteractor and delegates to AaveBufferLib
 */
contract AaveBufferInteractor {
    /// @dev Constant for the selector of the the AAVE's `deposit` function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant SUPPLY_SELECTOR =
        bytes4(keccak256("supply(address,uint256,address,uint16)"));

    /// @dev Constant for the selector of the AAVE's `withdraw` function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant WITHDRAW_SELECTOR =
        bytes4(keccak256("withdraw(address,uint256,address)"));

    /**
     * @dev Encodes the data for depositing into an AAVE Pool.
     * @param asset Deposit token's address.
     * @param receiver LP token receiver's address.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address asset,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(SUPPLY_SELECTOR, asset, amount, receiver, 0);
    }

    /**
     * @dev Encodes data for withdrawing from an AAVE Pool.
     * @param asset Deposit token's address.
     * @param receiver Address of the LP token receiver.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address asset,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(WITHDRAW_SELECTOR, asset, amount, receiver);
    }

    /**
     * @dev Gets the withdrawable ETH balance.
     * @param asset Deposit token's address.
     * @param owner LP token owner's address.
     * @return uint256 Withdrawable ETH balance.
     */
    function getEthBalance(address, address asset, address owner) external view returns (uint256) {
        return IERC20(asset).balanceOf(owner);
    }
}

/**
 * @title Compound Buffer Interactor
 * @notice Wrapper contract that implements IBufferInteractor and delegates to CompoundBufferLib
 */
contract CompoundBufferInteractor {
    /// @dev Constant for the selector of Compound's `deposit` function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant COMPOUND_SUPPLY_SELECTOR =
        bytes4(keccak256("supply(address,uint256)"));

    /// @dev Constant for the selector of Compound's withdraw function.
    // solhint-disable-next-line private-vars-leading-underscore
    bytes4 internal constant COMPOUND_WITHDRAW_SELECTOR =
        bytes4(keccak256("withdraw(address,uint256)"));

    /**
     * @dev Encodes data for depositing into a Compound Pool.
     * @param asset Deposit token's address.
     * @param amount Amount to deposit.
     * @return bytes Encoded message for the deposit transaction.
     */
    function encodeSupply(
        address asset,
        address,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(COMPOUND_SUPPLY_SELECTOR, asset, amount);
    }

    /**
     * @dev Encodes data for withdrawing from a Compound Pool.
     * @param asset Deposit token's address.
     * @param amount Amount to withdraw.
     * @return bytes Encoded message for the withdrawal transaction.
     */
    function encodeWithdraw(
        address asset,
        address,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(COMPOUND_WITHDRAW_SELECTOR, asset, amount);
    }

    /**
     * @dev Gets the withdrawable ETH balance.
     * @param asset Deposit token's address.
     * @param owner LP token owner's address.
     * @return uint256 Withdrawable ETH balance.
     */
    function getEthBalance(address, address asset, address owner) external view returns (uint256) {
        return IERC20(asset).balanceOf(owner);
    }
}

/**
 * @title MrETH Setup Contract
 * @notice Setup contract for mrETH system testing
 * @dev Provides deployment and initialization functions for mrETH contracts
 */
contract MrEthSetup is Test {
    // Constants from mrETH.ts
    bytes32 constant APPROVER_SALT = bytes32(0);
    ISignatureUtilsMixinTypes.SignatureWithExpiry public approverSignatureAndExpiry;
    address constant NATIVE_TOKEN = ConstantsCoreV2.NATIVE_TOKEN;
    uint64 constant GWEI = 1e9;
    uint16 public constant PERCENTAGE_FACTOR = 10_000;
    uint256 constant MAX_UINT256 = type(uint256).max;
    uint256 constant MAX_UINT16 = type(uint16).max;

    // Admin wallets
    address public owner;
    address public authorizedStaker;
    address public guardian;

    // Main contracts
    DepositManager public depositManager;
    AaveBufferInteractor public aaveBufferInteractor;
    CompoundBufferInteractor public compoundBufferInteractor;
    IWETH public weth = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IStrategyFactory public strategyFactory =
        IStrategyFactory(0x5e4C39Ad7A3E881585e383dB9827EB4811f6F647);
    IDelegationManager public delegationManager =
        IDelegationManager(0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A);
    Delegator public delegatorImplementation;

    // Core V2 contracts
    ISupplyManagerV2 public supplyManagerV2;
    address public mrETH;
    address public vaultWETH;
    address payable public vaultETH;
    address public vaultStETH;

    // Pool configuration
    IDepositManagerTypes.PoolData[] public poolDataArray;
    address[] public operatorsArray;
    address[] public poolsArray;
    bool[] public authArray;

    // Strategy and operator addresses (from mainnet config)
    IStrategy public stEthStrategy = IStrategy(0x93c4b944D05dfe6df7645A86cd2206016c51564D);
    address public defaultOperator = 0x5ACCC90436492F24E6aF278569691e2c942A676d;
    address public aavePool = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    address public awethAddress = 0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8;
    address public cWETHv3Address = 0xA17581A9E3356d9A858b789D68B4d866e593aE94;
    ILido public stEth = ILido(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

    uint16 constant APY_FORMATTER = 8_000;
    string constant MRETH_TOKEN_NAME = "mrETH release candidate";
    string constant MRETH_TOKEN_SYMBOL = "mrETHrec";
    uint8 constant MRETH_TOKEN_DECIMALS = 18;
    uint128 constant MRETH_TOKEN_MIN_DEPOSIT = 1e15;
    uint128 constant MRETH_TOKEN_MIN_REDEEM = 1e15;
    /**
     * @dev Setup function that deploys all necessary contracts
     */
    function setUp() public virtual {
        // Setup admin addresses
        owner = makeAddr("owner");
        authorizedStaker = makeAddr("authorizedStaker");
        guardian = makeAddr("guardian");

        vm.deal(owner, 10000 ether);
        vm.deal(authorizedStaker, 10000 ether);
        vm.deal(guardian, 10000 ether);

        // Initialize approver signature and expiry
        approverSignatureAndExpiry = ISignatureUtilsMixinTypes.SignatureWithExpiry({
            signature: "0x0",
            expiry: 0
        });

        // Deploy delegator implementation
        delegatorImplementation = new Delegator();

        // Deploy AaveBufferInteractor
        aaveBufferInteractor = new AaveBufferInteractor();

        // Deploy CompoundBufferInteractor
        compoundBufferInteractor = new CompoundBufferInteractor();

        // Calculate future contract addresses for proper initialization
        uint256 transactionCount = vm.getNonce(owner);

        // Predict SupplyManagerV2 address (nonce + 5) - after mock pool
        address supplyManagerFutureAddress = vm.computeCreateAddress(owner, transactionCount + 1);

        // Predict RebaseTokenV2 address (nonce + 6) - after SupplyManagerV2
        address rebaseERC20V2FutureAddress = vm.computeCreateAddress(owner, transactionCount + 2);

        // Deploy DepositManager with predicted SupplyManager address
        vm.startPrank(owner);
        depositManager = new DepositManager(
            owner,
            authorizedStaker,
            guardian,
            supplyManagerFutureAddress, // Use predicted address
            address(weth),
            address(strategyFactory),
            address(delegationManager),
            address(delegatorImplementation)
        );

        // Setup initial pool configuration
        _setupInitialPools();

        // Deploy core V2 contracts with predicted addresses
        _deployCoreV2Contracts(rebaseERC20V2FutureAddress);

        vm.stopPrank();
    }

    /**
     * @dev Setup initial pool configuration for testing
     */
    function _setupInitialPools() internal {
        // Clear storage arrays
        delete poolDataArray;
        delete poolsArray;
        delete authArray;

        // Pool 1: AAVE pool (100%)
        poolDataArray.push(
            IDepositManagerTypes.PoolData({
                poolToken: awethAddress,
                poolLib: address(aaveBufferInteractor),
                poolPortion: 10_000, // 100%
                poolId: 0
            })
        );

        poolsArray.push(aavePool);
        authArray.push(true);

        // Initialize DepositManager with AAVE pool
        depositManager.initialize(
            0, // buffer percentage
            poolsArray,
            poolDataArray,
            authArray
        );

        setupCompleteMrEthSystem();
    }

    /**
     * @dev Deploy core V2 contracts (SupplyManagerV2, RebaseTokenV2, Token Vaults)
     * @param rebaseERC20V2FutureAddress Predicted RebaseTokenV2 address
     */
    function _deployCoreV2Contracts(address rebaseERC20V2FutureAddress) internal {
        // Deploy SupplyManagerV2 with predicted RebaseTokenV2 address
        supplyManagerV2 = new SupplyManagerV2WithNative(
            owner,
            owner,
            address(depositManager),
            APY_FORMATTER,
            rebaseERC20V2FutureAddress // Use predicted address
        );

        // Deploy RebaseTokenV2 (mrETH token)
        RebaseTokenV2 rebaseTokenV2 = new RebaseTokenV2(
            address(supplyManagerV2),
            owner,
            MRETH_TOKEN_NAME,
            MRETH_TOKEN_SYMBOL,
            MRETH_TOKEN_DECIMALS,
            address(supplyManagerV2)
        );
        mrETH = address(rebaseTokenV2);

        // Verify that DepositManager's SupplyManagerV2 address matches the deployed one
        require(
            depositManager.SUPPLY_MANAGER() == address(supplyManagerV2),
            "DepositManager's SupplyManagerV2 address does not match deployed address"
        );

        // Deploy WETH token vault
        MrEthAssetTokenVault tokenVaultWETH = new MrEthAssetTokenVault(
            owner,
            mrETH,
            address(supplyManagerV2),
            owner
        );

        vaultWETH = address(tokenVaultWETH);
        // Initialize WETH vault
        tokenVaultWETH.init(address(weth), MRETH_TOKEN_MIN_DEPOSIT, MRETH_TOKEN_MIN_REDEEM);

        // Deploy stETH token vault
        MrEthAssetTokenVault tokenVaultStETH = new MrEthAssetTokenVault(
            owner,
            mrETH,
            address(supplyManagerV2),
            owner
        );
        vaultStETH = address(tokenVaultStETH);

        // Initialize stETH vault
        tokenVaultStETH.init(address(stEth), MRETH_TOKEN_MIN_DEPOSIT, MRETH_TOKEN_MIN_REDEEM);

        // Deploy native ETH token vault
        MrEthNativeTokenVault tokenVaultETH = new MrEthNativeTokenVault(
            owner,
            mrETH,
            address(supplyManagerV2),
            owner
        );
        vaultETH = payable(address(tokenVaultETH));

        // Initialize native ETH vault
        tokenVaultETH.init(NATIVE_TOKEN, MRETH_TOKEN_MIN_DEPOSIT, MRETH_TOKEN_MIN_REDEEM);

        // Add token vaults to whitelist and register them
        // Get deployed code hash for asset token vaults (WETH and stETH use the same type)
        bytes32 assetTokenVaultCodeHash = address(tokenVaultWETH).codehash;
        bytes32 nativeTokenVaultCodeHash = address(tokenVaultETH).codehash;

        // Set code hashes for both vault types
        rebaseTokenV2.setCodeHash(assetTokenVaultCodeHash, true);
        rebaseTokenV2.setCodeHash(nativeTokenVaultCodeHash, true);

        // Register all vaults
        rebaseTokenV2.addTokenVault(vaultWETH);
        rebaseTokenV2.addTokenVault(vaultStETH);
        rebaseTokenV2.addTokenVault(vaultETH);

        // Enable all vaults
        tokenVaultWETH.unpauseAll();
        tokenVaultStETH.unpauseAll();
        tokenVaultETH.unpauseAll();
    }

    /**
     * @dev Setup complete mrETH system with operator and strategies
     */
    function setupCompleteMrEthSystem() public {
        // Clear operatorsArray
        delete operatorsArray;

        operatorsArray.push(defaultOperator);

        uint64[] memory newDelegationPortions = new uint64[](1);

        newDelegationPortions[0] = 10_000;

        // Add default operator
        depositManager.addOperator(
            defaultOperator,
            APPROVER_SALT,
            approverSignatureAndExpiry,
            APPROVER_SALT,
            operatorsArray,
            newDelegationPortions // 100% allocation
        );

        // Add stETH strategy
        address[] memory strategies = new address[](1);
        IStrategy[] memory strategyAddresses = new IStrategy[](1);
        IStrategyLib[] memory strategyLibraries = new IStrategyLib[](1);

        strategies[0] = address(stEth);
        strategyAddresses[0] = stEthStrategy;
        strategyLibraries[0] = IStrategyLib(address(0));

        depositManager.addStrategies(strategies, strategyAddresses, strategyLibraries);
    }

    /**
     * @dev Generates a deposit root
     * @param pubkey The public key of the deposit
     * @param signature The signature of the deposit
     * @param withdrawal_credentials The withdrawal credentials of the deposit
     * @param _amountIn The amount of the deposit
     * @return The deposit root
     */
    function generateDepositRoot(
        bytes memory pubkey,
        bytes memory signature,
        bytes memory withdrawal_credentials,
        uint256 _amountIn
    ) internal pure returns (bytes32) {
        uint64 deposit_amount = uint64(_amountIn / GWEI);
        bytes memory amount = to_little_endian_64(deposit_amount);

        bytes32 pubkey_root = sha256(abi.encodePacked(pubkey, bytes16(0)));

        // Extract first 64 bytes of signature
        bytes memory firstChunk = extractBytes(signature, 0, 64);
        // Extract remaining bytes of signature
        bytes memory secondChunk = extractBytes(signature, 64, signature.length - 64);

        bytes32 signature_root = sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(firstChunk)),
                sha256(abi.encodePacked(secondChunk, bytes32(0)))
            )
        );
        return
            sha256(
                abi.encodePacked(
                    sha256(abi.encodePacked(pubkey_root, withdrawal_credentials)),
                    sha256(abi.encodePacked(amount, bytes24(0), signature_root))
                )
            );
    }

    /**
     * @dev Extracts a portion of a bytes array
     * @param data The bytes array to extract from
     * @param startIndex The starting index of the portion
     * @param length The length of the portion
     * @return result The extracted portion
     */
    function extractBytes(
        bytes memory data,
        uint256 startIndex,
        uint256 length
    ) internal pure returns (bytes memory) {
        require(startIndex + length <= data.length, "Range out of bounds");

        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[startIndex + i];
        }

        return result;
    }

    /**
     * @dev Converts a uint64 value to little endian bytes
     * @param value The uint64 value to convert
     * @return ret The little endian bytes representation of the value
     */
    function to_little_endian_64(uint64 value) internal pure returns (bytes memory ret) {
        ret = new bytes(8);
        bytes8 bytesValue = bytes8(value);
        // Byteswapping during copying to bytes.
        ret[0] = bytesValue[7];
        ret[1] = bytesValue[6];
        ret[2] = bytesValue[5];
        ret[3] = bytesValue[4];
        ret[4] = bytesValue[3];
        ret[5] = bytesValue[2];
        ret[6] = bytesValue[1];
        ret[7] = bytesValue[0];
    }
}
