import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { type mrEthNetworkConfig } from '../../../configs/ethereum';
import {
    DEPLOY_GAS_LIMIT,
    APPROVER_SIGNATURE_AND_EXPIRY,
    APPROVER_SALT,
    NATIVE_TOKEN,
} from '../../../configs/ethereum';

import { getMrEthConfig } from '../../utils/deployUtils';

/**
 * Deploys and initializes the core V2 contracts for the mrETH system.
 * This includes SupplyManagerV2, RebaseTokenV2, and various token vaults.
 */
async function deployMrEthCoreV2(
    hre: HardhatRuntimeEnvironment,
    owner: string,
    config: mrEthNetworkConfig,
    contractsMrEth: {
        depositManager: string;
        rebaseERC20V2FutureAddress: string;
    },
) {
    // Deploy and initialize SupplyManagerV2 with native token support
    const SupplyManagerV2 = await hre.ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.deploy(
        owner,
        owner,
        contractsMrEth.depositManager,
        config.APY_FORMATTER,
        contractsMrEth.rebaseERC20V2FutureAddress,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await supplyManagerV2.waitForDeployment();

    console.log('SupplyManagerV2 deployed successfully');

    // Deploy and initialize RebaseTokenV2 (mrETH token)
    const RebaseTokenV2 = await hre.ethers.getContractFactory('RebaseTokenV2');
    const rebaseTokenV2 = await RebaseTokenV2.deploy(
        supplyManagerV2,
        owner,
        config.MRETH_TOKEN_NAME,
        config.MRETH_TOKEN_SYMBOL,
        config.MRETH_TOKEN_DECIMALS,
        supplyManagerV2,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await rebaseTokenV2.waitForDeployment();

    console.log('RebaseTokenV2 deployed successfully');

    // Verify that SupplyManagerV2's RebaseTokenV2 address matches the deployed token
    if ((await supplyManagerV2.moleculaToken()) !== (await rebaseTokenV2.getAddress())) {
        console.error(
            "SupplyManagerV2's RebaseTokenV2 address does not match deployed RebaseTokenV2: ",
            contractsMrEth.rebaseERC20V2FutureAddress,
        );
        process.exit(1);
    }

    // Deploy and initialize token vaults for different asset types
    const TokenVault = await hre.ethers.getContractFactory('MrEthAssetTokenVault');

    // Deploy and initialize WETH token vault
    const tokenVaultWETH = await TokenVault.deploy(
        owner,
        await rebaseTokenV2.getAddress(),
        await supplyManagerV2.getAddress(),
        owner,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await tokenVaultWETH.waitForDeployment();

    // Initialize WETH vault with minimum deposit and redeem thresholds
    await tokenVaultWETH.init(
        config.WETH_ADDRESS,
        config.MRETH_TOKEN_MIN_DEPOSIT, // Minimum deposit value (0.000001 WETH)
        config.MRETH_TOKEN_MIN_REDEEM, // Minimum redeem shares (1 share)
    );

    console.log('WETH token vault deployed successfully');

    // Deploy and initialize stETH token vault
    const tokenVaultStETH = await TokenVault.deploy(owner, rebaseTokenV2, supplyManagerV2, owner, {
        gasLimit: DEPLOY_GAS_LIMIT,
    });
    await tokenVaultStETH.waitForDeployment();

    // Initialize stETH vault with minimum deposit and redeem thresholds
    await tokenVaultStETH.init(
        config.STETH_ADDRESS,
        config.MRETH_TOKEN_MIN_DEPOSIT, // Minimum deposit value (0.000001 WETH)
        config.MRETH_TOKEN_MIN_REDEEM, // Minimum redeem shares (1 share)
    );

    console.log('stETH token vault deployed successfully');

    // Deploy and initialize native ETH token vault
    const NativeTokenVault = await hre.ethers.getContractFactory('MrEthNativeTokenVault');
    const nativeTokenVault = await NativeTokenVault.deploy(
        owner,
        rebaseTokenV2,
        supplyManagerV2,
        owner,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await nativeTokenVault.waitForDeployment();

    // Initialize native ETH vault with minimum deposit and redeem thresholds
    await nativeTokenVault.init(
        NATIVE_TOKEN,
        config.MRETH_TOKEN_MIN_DEPOSIT, // Minimum deposit value (0.000001 WETH)
        config.MRETH_TOKEN_MIN_REDEEM, // Minimum redeem shares (1 share)
        { gasLimit: DEPLOY_GAS_LIMIT },
    );

    console.log('Native token vault deployed successfully');

    // Add token vaults to whitelist and set their code hashes
    const codeHash = hre.ethers.keccak256((await tokenVaultWETH.getDeployedCode())!);
    await rebaseTokenV2.setCodeHash(codeHash, true);

    // Register WETH and stETH vaults
    await rebaseTokenV2.addTokenVault(tokenVaultWETH, { gasLimit: DEPLOY_GAS_LIMIT });
    await rebaseTokenV2.addTokenVault(tokenVaultStETH, { gasLimit: DEPLOY_GAS_LIMIT });

    // Register native ETH vault
    const codeHash2 = hre.ethers.keccak256((await nativeTokenVault.getDeployedCode())!);
    await rebaseTokenV2.setCodeHash(codeHash2, true);
    await rebaseTokenV2.addTokenVault(nativeTokenVault, { gasLimit: DEPLOY_GAS_LIMIT });

    // Enable all vaults by unpausing them
    await tokenVaultWETH.unpauseAll();
    await nativeTokenVault.unpauseAll();
    await tokenVaultStETH.unpauseAll();

    console.log('Token vaults initialized successfully');

    return {
        supplyManagerV2: await supplyManagerV2.getAddress(),
        mrETH: await rebaseTokenV2.getAddress(),
        vaultWETH: await tokenVaultWETH.getAddress(),
        vaultETH: await nativeTokenVault.getAddress(),
        vaultStETH: await tokenVaultStETH.getAddress(),
    };
}

/**
 * Main deployment function for the mrETH system.
 * Deploys all necessary contracts and initializes them with the correct configuration.
 */
export async function deployMrEth(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const { config, account } = await getMrEthConfig(hre, environment, hre.network.name);

    // Deploy buffer libraries for different protocols
    const AaveBufferLib = await hre.ethers.getContractFactory('AaveBufferLib');
    const aaveBufferLib = await AaveBufferLib.deploy({ gasLimit: DEPLOY_GAS_LIMIT });
    await aaveBufferLib.waitForDeployment();
    const aavePool = config.AAVE_POOL;

    const CompoundBufferLib = await hre.ethers.getContractFactory('CompoundBufferLib');
    const compoundBufferLib = await CompoundBufferLib.deploy({ gasLimit: DEPLOY_GAS_LIMIT });
    await compoundBufferLib.waitForDeployment();

    console.log('Buffer libraries deployed successfully');

    // Get Delegator implementation contract factory for selected chain
    const DelegatorImplementation =
        hre.network.name === 'sepolia'
            ? await hre.ethers.getContractFactory('MockSepoliaDelegator')
            : await hre.ethers.getContractFactory('Delegator');

    // Deploy delegator implementation for strategy delegation

    const delegatorImplementation = await DelegatorImplementation.deploy({
        gasLimit: DEPLOY_GAS_LIMIT,
    });
    await delegatorImplementation.waitForDeployment();

    console.log('Delegator implementation deployed successfully');

    // Calculate future contract addresses for proper initialization
    const transactionCount = await account.getNonce();

    const supplyManagerFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount + 4,
    });

    const rebaseERC20V2FutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount + 5,
    });

    // Get DepositManager contract factory for selected chain
    const DepositManager =
        hre.network.name === 'sepolia'
            ? await hre.ethers.getContractFactory('MockSepoliaDepositManager')
            : await hre.ethers.getContractFactory('DepositManager');

    // Deploy and initialize DepositManager
    const depositManager = await DepositManager.deploy(
        account.address,
        account.address,
        account.address,
        supplyManagerFutureAddress,
        config.WETH_ADDRESS,
        config.STRATEGY_FACTORY,
        config.DELEGATION_MANAGER,
        config.REWARDS_COORDINATOR,
        await delegatorImplementation.getAddress(),
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await depositManager.waitForDeployment();

    console.log('DepositManager deployed successfully');

    // Initialize DepositManager with Aave pool configuration
    await depositManager.initialize(0, [
        {
            pool: aavePool,
            newPoolData: {
                poolToken: config.AWETH_ADDRESS,
                poolLib: await aaveBufferLib.getAddress(),
                poolPortion: 10_000n, // 100% allocation
                poolId: 0,
            },
            auth: true,
        },
    ]);

    // Configure operators and strategies
    await depositManager.addOperator(
        config.EIGENLAYER_OPERATOR,
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        APPROVER_SIGNATURE_AND_EXPIRY,
        APPROVER_SALT,
        [config.EIGENLAYER_OPERATOR],
        [10_000n], // 100% allocation
        { gasLimit: DEPLOY_GAS_LIMIT },
    );

    // Add stETH strategy
    await depositManager.addStrategies(
        [config.STETH_ADDRESS],
        [config.STRATEGY_BASE_STETH],
        [hre.ethers.ZeroAddress],
    );

    console.log('DepositManager initialized successfully');

    // Deploy core V2 contracts
    const coreV2 = await deployMrEthCoreV2(hre, await account.getAddress(), config, {
        depositManager: await depositManager.getAddress(),
        rebaseERC20V2FutureAddress,
    });

    console.log('Core V2 contracts deployed successfully');

    // Verify that DepositManager's SupplyManagerV2 address matches the deployed one
    if ((await depositManager.SUPPLY_MANAGER()) !== coreV2.supplyManagerV2) {
        console.error(
            "DepositManager's SupplyManagerV2 address does not match deployed SupplyManagerV2: ",
            supplyManagerFutureAddress,
        );
        process.exit(1);
    }

    // Log deployment information
    console.log('Deployment Block #', await hre.ethers.provider.getBlockNumber());
    console.log('DepositManager address: ', await depositManager.getAddress());
    console.log('SupplyManager address: ', coreV2.supplyManagerV2);
    console.log('MrETH token address: ', coreV2.mrETH);

    // Return all deployed contract addresses
    const eth = {
        ...coreV2,
        depositManager: await depositManager.getAddress(),
        delegatorImplementation: await delegatorImplementation.getAddress(),
    };

    return eth;
}
