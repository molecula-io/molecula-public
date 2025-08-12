/* eslint-disable camelcase */
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import {
    ethMrEthMainnetBetaConfig,
    APPROVER_SIGNATURE_AND_EXPIRY,
    APPROVER_SALT,
    NATIVE_TOKEN,
    ETH_VIRTUAL_OFFSET,
} from '../../configs/ethereum';

import { FAUCET, grantERC20 } from './grant';

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
    const supplyManagerFutureAddress = ethers.getCreateAddress({
        from: owner.address,
        nonce: transactionCount + 3,
    });

    const rewardBearingTokenFutureAddress = ethers.getCreateAddress({
        from: owner.address,
        nonce: transactionCount + 4,
    });

    // Deploy and initialize DepositManager
    const DepositManager = await ethers.getContractFactory('DepositManager');
    const depositManager = await DepositManager.connect(owner!).deploy(
        owner.address,
        owner.address,
        owner.address,
        supplyManagerFutureAddress,
        ethMrEthMainnetBetaConfig.WETH_ADDRESS,
        ethMrEthMainnetBetaConfig.STRATEGY_FACTORY,
        ethMrEthMainnetBetaConfig.DELEGATION_MANAGER,
        rewardsCoordinator,
        delegatorImplementation,
    );

    await expect(
        depositManager.initialize(moleculaBuffer, 10_001n, [
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
    ).to.be.rejectedWith('EInvalidPercentage()');

    // Initialize DepositManager with Aave pool
    await depositManager.initialize(moleculaBuffer, 0, [
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
    ]);

    // Deploy and initialize SupplyManagerV2
    const SupplyManagerV2 = await ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.connect(owner).deploy(
        owner,
        owner,
        depositManager,
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

    await expect(depositManager.chooseDelegatorForDeposit()).to.be.rejectedWith(
        'EOperatorNotExists()',
    );
    // Initialize operators and strategies
    await depositManager.addOperator(
        defaultOperator,
        APPROVER_SALT,
        APPROVER_SIGNATURE_AND_EXPIRY,
        APPROVER_SALT,
        [defaultOperator],
        [10_000n],
    );
    await depositManager.addStrategies(
        [ethMrEthMainnetBetaConfig.STETH_ADDRESS],
        [ethMrEthMainnetBetaConfig.STRATEGY_BASE_STETH],
        [ethers.ZeroAddress],
    );

    await expect(
        depositManager.addStrategies(
            [WETH],
            [ethMrEthMainnetBetaConfig.STRATEGY_BASE_STETH],
            [ethers.ZeroAddress],
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
    );

    await wEthVault.init(
        WETH,
        10n ** 6n, // Minimum deposit value
        10n ** 18n, // Minimum redeem shares
    );

    // Deploy and initialize stETH token vault
    const stEthVault = await TokenVault.connect(owner).deploy(
        owner,
        rewardBearingToken,
        supplyManagerV2,
        owner!.address,
    );

    await stEthVault.init(
        stETH,
        10n ** 6n, // Minimum deposit value
        10n ** 18n, // Minimum redeem shares
    );

    // Deploy and initialize native token vault
    const NativeTokenVault = await ethers.getContractFactory('MrEthNativeTokenVault');
    const nativeVault = await NativeTokenVault.deploy(
        owner!.address,
        rewardBearingToken,
        supplyManagerV2,
        owner!.address,
    );

    await nativeVault.init(
        NATIVE_TOKEN,
        10n ** 6n, // Minimum deposit assets
        10n ** 18n, // Minimum redeem shares
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
    );

    await tokenVaultCWETH_V3.init(
        cWETHv3,
        10n ** 6n, // Minimum deposit value
        10n ** 18n, // Minimum redeem shares
    );

    await expect(rewardBearingToken.addTokenVault(tokenVaultCWETH_V3)).to.be.reverted;

    // Get default delegator
    const defaultDelegatorAddress = await depositManager.chooseDelegatorForDeposit();

    // Get default withdrawal credentials and approve tokens
    const defaultWithdrawalCredentials =
        await depositManager.getWithdrawalCredentials(defaultDelegatorAddress);
    await WETH.approve(wEthVault, ethers.MaxUint256);
    await WETH.connect(user0).approve(wEthVault, ethers.MaxUint256);

    await stETH.approve(stEthVault, ethers.MaxUint256);
    await stETH.connect(user0).approve(stEthVault, ethers.MaxUint256);

    // Unpause token vaults
    await wEthVault.unpauseAll();
    await stEthVault.unpauseAll();

    await expect(
        depositManager.initialize(moleculaBuffer, 0, [
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
    ).to.be.rejectedWith('InvalidInitialization()');

    await expect(
        depositManager.connect(user0).initialize(moleculaBuffer, 0, [
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
    ).to.be.rejectedWith('OwnableUnauthorizedAccount(');

    return {
        depositManager,
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
        defaultOperator,
        defaultWithdrawalCredentials,
        moleculaBuffer,
    };
}
