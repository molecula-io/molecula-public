/* eslint-disable camelcase, max-lines */
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import {
    ethMrEthMainnetBetaConfig,
    APPROVER_SIGNATURE_AND_EXPIRY,
    APPROVER_SALT,
    NATIVE_TOKEN,
    ETH_VIRTUAL_OFFSET,
} from '../../configs';

import { FAUCET, grantERC20 } from './grant';
import { callContractWithData, safeInterfaceCast } from './helpers';

/**
 * Deploys and initializes the mrETH system with all necessary contracts and configurations
 * @returns Object containing all deployed contracts and test accounts
 */
export async function deployMrETh() {
    const virtualOffset = ETH_VIRTUAL_OFFSET;
    const signers = await ethers.getSigners();

    const owner = signers.at(0)!;
    const user0 = signers.at(1)!;
    const user1 = signers.at(2)!;
    const user2 = signers.at(3)!;

    // Initialize token contracts
    const stETH = await ethers.getContractAt(
        'IERC20Metadata',
        ethMrEthMainnetBetaConfig.STETH_ADDRESS,
    );
    const WETH = await ethers.getContractAt('IERC20', ethMrEthMainnetBetaConfig.WETH_ADDRESS);
    const aWETH = await ethers.getContractAt('IERC20', ethMrEthMainnetBetaConfig.AWETH_ADDRESS);
    const cWETHv3 = await ethers.getContractAt('IERC20', ethMrEthMainnetBetaConfig.CWETH_V3);

    // Grant test tokens to owner and user0
    await grantERC20(owner, WETH, ethers.parseEther('100'));
    await grantERC20(user0, WETH, ethers.parseEther('100'));

    // Grant stETH tokens to owner and user0
    await grantERC20(owner, stETH, ethers.parseEther('100'), FAUCET.stETH);
    await grantERC20(user0, stETH, ethers.parseEther('100'), FAUCET.stETH);

    // Deploy buffer libraries
    const AaveBufferLib = await ethers.getContractFactory('AaveBufferLib');
    const aaveBufferLib = await AaveBufferLib.connect(owner!).deploy();
    const aavePool = ethMrEthMainnetBetaConfig.AAVE_POOL;

    const CompoundBufferLib = await ethers.getContractFactory('CompoundBufferLib');
    const compoundBufferLib = await CompoundBufferLib.connect(owner!).deploy();

    const DepositManagerLib = await ethers.getContractFactory('DepositManagerLib');
    const depositManagerLib = await DepositManagerLib.connect(owner!).deploy();

    // Deploy delegator implementation
    const DelegatorImplementation = await ethers.getContractFactory('Delegator');
    const delegatorImplementation = await DelegatorImplementation.deploy();

    // Deploy Molecula Buffer
    const MoleculaBuffer = await ethers.getContractFactory('MoleculaBuffer');
    const moleculaBuffer = await MoleculaBuffer.deploy(
        ethMrEthMainnetBetaConfig.MOLECULA_BUFFER_NAME,
        ethMrEthMainnetBetaConfig.MOLECULA_BUFFER_SYMBOL,
        owner.address,
        ethMrEthMainnetBetaConfig.WETH_ADDRESS,
    );

    // Deploy mock rewards coordinator
    const RewardsCoordinator = await ethers.getContractFactory('MockRewardsCoordinator');
    const rewardsCoordinator = await RewardsCoordinator.connect(owner!).deploy();

    // Grant stETH and WETH tokens to rewards coordinator
    await grantERC20(rewardsCoordinator, stETH, ethers.parseEther('100'), FAUCET.stETH);
    await grantERC20(rewardsCoordinator, WETH, ethers.parseEther('100'));

    // Calculate future contract addresses for initialization
    const transactionCount = await owner.getNonce();

    const depositManagerRestakerFutureAddress = ethers.getCreateAddress({
        from: owner.address,
        nonce: transactionCount + 1,
    });

    const supplyManagerFutureAddress = ethers.getCreateAddress({
        from: owner.address,
        nonce: transactionCount + 4,
    });

    const rewardBearingTokenFutureAddress = ethers.getCreateAddress({
        from: owner.address,
        nonce: transactionCount + 5,
    });

    // Deploy and initialize DepositManagerPool
    const DepositManagerPool = await ethers.getContractFactory('DepositManagerPool');
    const depositManagerPool = await DepositManagerPool.connect(owner!).deploy(
        owner.address,
        supplyManagerFutureAddress,
        ethMrEthMainnetBetaConfig.WETH_ADDRESS,
        ethMrEthMainnetBetaConfig.STRATEGY_FACTORY,
        ethMrEthMainnetBetaConfig.DELEGATION_MANAGER,
        rewardsCoordinator,
        depositManagerRestakerFutureAddress,
    );

    const DepositManagerRestaker = await ethers.getContractFactory('DepositManagerRestaker');
    const depositManagerRestaker = await DepositManagerRestaker.connect(owner!).deploy();

    const depositManagerRestakerInterface = safeInterfaceCast(depositManagerRestaker.interface);

    await expect(
        depositManagerPool.initialize(
            delegatorImplementation,
            moleculaBuffer,
            depositManagerLib,
            10_001n,
            [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: ethMrEthMainnetBetaConfig.AWETH_ADDRESS,
                        poolLib: aaveBufferLib,
                        poolPortion: 10_000n,
                        poolId: 0,
                    },
                    auth: true,
                },
            ],
        ),
    ).to.be.rejectedWith('EInvalidPercentage()');

    // Initialize DepositManager with Aave pool
    await depositManagerPool.initialize(
        delegatorImplementation,
        moleculaBuffer,
        depositManagerLib,
        0,
        [
            {
                pool: aavePool,
                newPoolData: {
                    poolToken: ethMrEthMainnetBetaConfig.AWETH_ADDRESS,
                    poolLib: aaveBufferLib,
                    poolPortion: 10_000n,
                    poolId: 0,
                },
                auth: true,
            },
        ],
    );

    // Deploy and initialize SupplyManagerV2
    const SupplyManagerV2 = await ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.connect(owner).deploy(
        owner,
        owner,
        depositManagerPool,
        4000,
        rewardBearingTokenFutureAddress,
        virtualOffset,
    );

    expect(supplyManagerV2).to.be.equal(supplyManagerFutureAddress);

    // Deploy and initialize RewardBearingToken
    const RewardBearingToken = await ethers.getContractFactory('RewardBearingToken');
    const rewardBearingToken = await RewardBearingToken.connect(owner).deploy(
        ethMrEthMainnetBetaConfig.MRETH_TOKEN_NAME,
        ethMrEthMainnetBetaConfig.MRETH_TOKEN_SYMBOL,
        owner,
        supplyManagerV2,
        supplyManagerV2,
    );
    expect(rewardBearingToken).to.be.equal(rewardBearingTokenFutureAddress);
    const defaultOperator = ethMrEthMainnetBetaConfig.EIGENLAYER_OPERATOR;
    await expect(depositManagerPool.chooseDelegatorForDeposit()).to.be.rejectedWith(
        'EOperatorNotExists()',
    );

    await depositManagerPool.setMinFeePercentage(500n);
    await depositManagerPool.setMaxFeePercentage(1000n);
    await depositManagerPool.grantRole(
        await depositManagerPool.AUTHORIZED_STAKER_ROLE(),
        owner.address,
    );
    await depositManagerPool.grantRole(await depositManagerPool.GUARDIAN_ROLE(), owner.address);

    // Initialize operators and strategies
    await callContractWithData(
        owner,
        depositManagerPool,
        depositManagerRestakerInterface,
        'addOperator',
        [
            defaultOperator,
            APPROVER_SALT,
            APPROVER_SIGNATURE_AND_EXPIRY,
            APPROVER_SALT,
            [defaultOperator],
            [10_000n],
        ],
    );

    await depositManagerPool.chooseDelegatorForDeposit();

    await callContractWithData(
        owner,
        depositManagerPool,
        depositManagerRestakerInterface,
        'addStrategies',
        [
            [
                {
                    token: ethMrEthMainnetBetaConfig.STETH_ADDRESS,
                    newStrategy: ethMrEthMainnetBetaConfig.STRATEGY_BASE_STETH,
                    strategyLib: ethers.ZeroAddress,
                },
            ],
        ],
    );

    await expect(
        callContractWithData(
            owner,
            depositManagerPool,
            depositManagerRestakerInterface,
            'addStrategies',
            [
                [
                    {
                        token: ethMrEthMainnetBetaConfig.WETH_ADDRESS,
                        newStrategy: ethMrEthMainnetBetaConfig.STRATEGY_BASE_STETH,
                        strategyLib: ethers.ZeroAddress,
                    },
                ],
            ],
        ),
    ).to.be.rejectedWith('EInvalidStrategyConfiguration("Underlying token mismatch")');

    // Deploy and initialize token vaults
    const TokenVault = await ethers.getContractFactory('MrEthAssetTokenVault');

    // Deploy and initialize WETH token vault
    const wEthVault = await TokenVault.connect(owner).deploy(
        owner,
        rewardBearingToken,
        supplyManagerV2,
        owner!.address,
        owner!.address,
    );

    await wEthVault.init(
        WETH,
        10n ** 6n, // Minimum deposit value
        10n ** 15n, // Minimum redeem shares
    );

    // Deploy and initialize stETH token vault
    const stEthVault = await TokenVault.connect(owner).deploy(
        owner,
        rewardBearingToken,
        supplyManagerV2,
        owner!.address,
        owner!.address,
    );

    await stEthVault.init(
        stETH,
        10n ** 6n, // Minimum deposit value
        10n ** 15n, // Minimum redeem shares
    );

    // Deploy and initialize native token vault
    const NativeTokenVault = await ethers.getContractFactory('MrEthNativeTokenVault');
    const nativeVault = await NativeTokenVault.deploy(
        owner!.address,
        rewardBearingToken,
        supplyManagerV2,
        owner!.address,
        owner!.address,
    );

    await nativeVault.init(
        NATIVE_TOKEN,
        10n ** 6n, // Minimum deposit assets
        10n ** 15n, // Minimum redeem shares
    );

    // Add token vaults to whitelist
    const codeHash = keccak256((await wEthVault.getDeployedCode())!);
    await rewardBearingToken.setCodeHash(codeHash, true);

    await rewardBearingToken.addTokenVault(wEthVault);
    await rewardBearingToken.addTokenVault(stEthVault);

    const codeHash2 = keccak256((await nativeVault.getDeployedCode())!);
    await rewardBearingToken.setCodeHash(codeHash2, true);
    await rewardBearingToken.addTokenVault(nativeVault);
    await nativeVault.unpauseRequestDeposit();
    await nativeVault.unpauseRequestRedeem();

    // Test token vault addition revert case
    const tokenVaultCWETH_V3 = await TokenVault.connect(owner).deploy(
        owner,
        rewardBearingToken,
        supplyManagerV2,
        owner!.address,
        owner!.address,
    );

    await tokenVaultCWETH_V3.init(
        cWETHv3,
        10n ** 6n, // Minimum deposit value
        10n ** 18n, // Minimum redeem shares
    );

    await expect(rewardBearingToken.addTokenVault(tokenVaultCWETH_V3)).to.be.reverted;

    // Get default delegator
    const defaultDelegatorAddress = await depositManagerPool.chooseDelegatorForDeposit();

    // Get default withdrawal credentials and approve tokens
    const defaultWithdrawalCredentials =
        await depositManagerPool.getWithdrawalCredentials(defaultDelegatorAddress);

    await WETH.approve(wEthVault, ethers.MaxUint256);
    await WETH.connect(user0).approve(wEthVault, ethers.MaxUint256);

    await stETH.approve(stEthVault, ethers.MaxUint256);
    await stETH.connect(user0).approve(stEthVault, ethers.MaxUint256);

    // Unpause token vaults
    await wEthVault.unpauseAll();
    await stEthVault.unpauseAll();

    await expect(
        depositManagerPool.initialize(
            delegatorImplementation,
            moleculaBuffer,
            depositManagerLib,
            0,
            [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: ethMrEthMainnetBetaConfig.AWETH_ADDRESS,
                        poolLib: aaveBufferLib,
                        poolPortion: 10_000n,
                        poolId: 0,
                    },
                    auth: true,
                },
            ],
        ),
    ).to.be.rejectedWith('InvalidInitialization()');

    await expect(
        depositManagerPool
            .connect(user0)
            .initialize(delegatorImplementation, moleculaBuffer, depositManagerLib, 0, [
                {
                    pool: aavePool,
                    newPoolData: {
                        poolToken: ethMrEthMainnetBetaConfig.AWETH_ADDRESS,
                        poolLib: aaveBufferLib,
                        poolPortion: 10_000n,
                        poolId: 0,
                    },
                    auth: true,
                },
            ]),
    ).to.be.rejectedWith('AccessControlUnauthorizedAccount(');

    return {
        depositManagerPool,
        depositManagerRestakerInterface,
        supplyManagerV2,
        rewardBearingToken,
        wEthVault,
        stEthVault,
        nativeVault,
        owner,
        user0,
        user1,
        user2,
        WETH,
        aWETH,
        cWETHv3,
        stETH,
        aavePool,
        aaveBufferLib,
        compoundBufferLib,
        depositManagerLib,
        defaultOperator,
        defaultWithdrawalCredentials,
        moleculaBuffer,
    };
}
