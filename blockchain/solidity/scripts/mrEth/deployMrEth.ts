import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { type mrEthNetworkConfig } from '../../configs';
import {
    DEPLOY_GAS_LIMIT,
    APPROVER_SIGNATURE_AND_EXPIRY,
    APPROVER_SALT,
    NATIVE_TOKEN,
    ETH_VIRTUAL_OFFSET,
} from '../../configs';

import { getMrEthConfig } from '../utils/deployUtils';

/**
 * Deploys and initializes the core V2 contracts for the mrETH system.
 * This includes SupplyManagerV2, rewardBearingToken, and various token vaults.
 */
async function deployMrEthCoreV2(
    hre: HardhatRuntimeEnvironment,
    owner: string,
    config: mrEthNetworkConfig,
    contractsMrEth: {
        depositManager: string;
        rewardBearingTokenFutureAddress: string;
    },
) {
    // Deploy and initialize SupplyManagerV2 with native token support
    const SupplyManagerV2 = await hre.ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.deploy(
        owner,
        owner,
        contractsMrEth.depositManager,
        config.APY_FORMATTER,
        contractsMrEth.rewardBearingTokenFutureAddress,
        ETH_VIRTUAL_OFFSET,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await supplyManagerV2.waitForDeployment();

    console.log(`SupplyManagerV2 deployed successfully at ${await supplyManagerV2.getAddress()}`);

    // Deploy and initialize RewardBearingToken (mrETH token)
    const RewardBearingToken = await hre.ethers.getContractFactory('RewardBearingToken');
    const rewardBearingToken = await RewardBearingToken.deploy(
        config.MRETH_TOKEN_NAME,
        config.MRETH_TOKEN_SYMBOL,
        owner,
        supplyManagerV2,
        supplyManagerV2,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await rewardBearingToken.waitForDeployment();

    console.log(
        `rewardBearingToken deployed successfully at ${await rewardBearingToken.getAddress()}`,
    );

    // Verify that SupplyManagerV2's rewardBearingToken address matches the deployed token
    if ((await supplyManagerV2.moleculaToken()) !== (await rewardBearingToken.getAddress())) {
        console.error(
            "SupplyManagerV2's rewardBearingToken address does not match deployed rewardBearingToken: ",
            contractsMrEth.rewardBearingTokenFutureAddress,
        );
        process.exit(1);
    }

    // Deploy and initialize token vaults for different asset types
    const TokenVault = await hre.ethers.getContractFactory('MrEthAssetTokenVault');

    // Deploy and initialize WETH token vault
    const wEthVault = await TokenVault.deploy(
        owner,
        await rewardBearingToken.getAddress(),
        await supplyManagerV2.getAddress(),
        owner,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await wEthVault.waitForDeployment();

    // Initialize WETH vault with minimum deposit and redeem thresholds
    let tx = await wEthVault.init(
        config.WETH_ADDRESS,
        config.MRETH_TOKEN_MIN_DEPOSIT, // Minimum deposit value (0.000001 WETH)
        config.MRETH_TOKEN_MIN_REDEEM, // Minimum redeem shares (1 share)
    );
    await tx.wait();

    console.log(`WETH token vault deployed successfully at ${await wEthVault.getAddress()}`);

    // Deploy and initialize stETH token vault
    const stEthVault = await TokenVault.deploy(owner, rewardBearingToken, supplyManagerV2, owner, {
        gasLimit: DEPLOY_GAS_LIMIT,
    });
    await stEthVault.waitForDeployment();

    // Initialize stETH vault with minimum deposit and redeem thresholds
    tx = await stEthVault.init(
        config.STETH_ADDRESS,
        config.MRETH_TOKEN_MIN_DEPOSIT, // Minimum deposit value (0.000001 WETH)
        config.MRETH_TOKEN_MIN_REDEEM, // Minimum redeem shares (1 share)
    );
    await tx.wait();

    console.log(`stETH token vault deployed successfully at ${await stEthVault.getAddress()}`);

    // Deploy and initialize native ETH token vault
    const NativeTokenVault = await hre.ethers.getContractFactory('MrEthNativeTokenVault');
    const nativeVault = await NativeTokenVault.deploy(
        owner,
        rewardBearingToken,
        supplyManagerV2,
        owner,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await nativeVault.waitForDeployment();

    // Initialize native ETH vault with minimum deposit and redeem thresholds
    tx = await nativeVault.init(
        NATIVE_TOKEN,
        config.MRETH_TOKEN_MIN_DEPOSIT, // Minimum deposit value (0.000001 WETH)
        config.MRETH_TOKEN_MIN_REDEEM, // Minimum redeem shares (1 share)
    );
    await tx.wait();

    console.log(`Native token vault deployed successfully at ${await nativeVault.getAddress()}`);

    // Add token vaults to whitelist and set their code hashes
    const codeHash = hre.ethers.keccak256((await wEthVault.getDeployedCode())!);
    tx = await rewardBearingToken.setCodeHash(codeHash, true);
    await tx.wait();

    // Register WETH vault
    tx = await rewardBearingToken.addTokenVault(wEthVault);
    await tx.wait();

    // Register stETH vault
    tx = await rewardBearingToken.addTokenVault(stEthVault);
    await tx.wait();

    // Register native ETH vault
    const codeHash2 = hre.ethers.keccak256((await nativeVault.getDeployedCode())!);

    tx = await rewardBearingToken.setCodeHash(codeHash2, true);
    await tx.wait();

    tx = await rewardBearingToken.addTokenVault(nativeVault);
    await tx.wait();

    console.log('Success register all vaults');

    // Enable all vaults by unpausing them
    tx = await wEthVault.unpauseAll();
    await tx.wait();
    tx = await nativeVault.unpauseAll();
    await tx.wait();
    tx = await stEthVault.unpauseAll();
    await tx.wait();

    console.log('Token vaults initialized successfully');

    return {
        supplyManagerV2: await supplyManagerV2.getAddress(),
        mrETH: await rewardBearingToken.getAddress(),
        wEthVault: await wEthVault.getAddress(),
        ethVault: await nativeVault.getAddress(),
        stEthVault: await stEthVault.getAddress(),
    };
}

/**
 * Main deployment function for the mrETH system.
 * Deploys all necessary contracts and initializes them with the correct configuration.
 */
export async function deployMrEth(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    const { config, account } = await getMrEthConfig(hre, environment, hre.network.name);

    console.log(`Deployer account address: ${await account.getAddress()}`);

    // Deploy buffer libraries for different protocols
    const AaveBufferLib = await hre.ethers.getContractFactory('AaveBufferLib');
    const aaveBufferLib = await AaveBufferLib.deploy({ gasLimit: DEPLOY_GAS_LIMIT });
    await aaveBufferLib.waitForDeployment();
    const aavePool = config.AAVE_POOL;

    console.log(`AaveBufferLib deployed successfully at ${await aaveBufferLib.getAddress()}`);

    const CompoundBufferLib = await hre.ethers.getContractFactory('CompoundBufferLib');
    const compoundBufferLib = await CompoundBufferLib.deploy({ gasLimit: DEPLOY_GAS_LIMIT });
    await compoundBufferLib.waitForDeployment();

    console.log(
        `CompoundBufferLib deployed successfully at ${await compoundBufferLib.getAddress()}`,
    );

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

    console.log(
        `Delegator implementation deployed successfully at ${await delegatorImplementation.getAddress()}`,
    );

    // Deploy MoleculaBuffer
    const MoleculaBuffer = await hre.ethers.getContractFactory('MoleculaBuffer');
    const moleculaBuffer = await MoleculaBuffer.deploy(
        config.MOLECULA_BUFFER_NAME,
        config.MOLECULA_BUFFER_SYMBOL,
        account.address,
        config.WETH_ADDRESS,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await moleculaBuffer.waitForDeployment();
    console.log(`MoleculaBuffer deployed successfully at ${await moleculaBuffer.getAddress()}`);

    // Calculate future contract addresses for proper initialization
    const transactionCount = await account.getNonce();

    const supplyManagerFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount + 4,
    });

    const rewardBearingTokenFutureAddress = hre.ethers.getCreateAddress({
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

    console.log(`DepositManager deployed successfully at ${await depositManager.getAddress()}`);

    // Initialize DepositManager with Aave pool configuration
    let tx = await depositManager.initialize(await moleculaBuffer.getAddress(), 0, [
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
    await tx.wait();

    // Configure operators and strategies
    tx = await depositManager.addOperator(
        config.EIGENLAYER_OPERATOR,
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        APPROVER_SIGNATURE_AND_EXPIRY,
        APPROVER_SALT,
        [config.EIGENLAYER_OPERATOR],
        [10_000n], // 100% allocation
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await tx.wait();

    // Add stETH strategy
    tx = await depositManager.addStrategies(
        [config.STETH_ADDRESS],
        [config.STRATEGY_BASE_STETH],
        [hre.ethers.ZeroAddress],
    );
    await tx.wait();

    console.log('DepositManager initialized successfully');

    // Deploy core V2 contracts
    const coreV2 = await deployMrEthCoreV2(hre, await account.getAddress(), config, {
        depositManager: await depositManager.getAddress(),
        rewardBearingTokenFutureAddress,
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
        moleculaBuffer: await moleculaBuffer.getAddress(),
    };

    return eth;
}
