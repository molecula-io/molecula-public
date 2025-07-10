/* eslint-disable camelcase */
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import {
    APPROVER_SIGNATURE_AND_EXPIRY,
    APPROVER_SALT,
    NATIVE_TOKEN,
} from '../../configs/ethereum/constants';
import { ethMainnetBetaConfig } from '../../configs/ethereum/mainnetBetaTyped';

import { FAUCET, grantERC20 } from './grant';

/**
 * Deploys and initializes the mrETH system with all necessary contracts and configurations
 * @returns Object containing all deployed contracts and test accounts
 */
export async function deployMrETh() {
    const signers = await ethers.getSigners();

    const owner = signers.at(0)!;
    const user0 = signers.at(1)!;
    const user1 = signers.at(2)!;
    const user2 = signers.at(3)!;

    // Initialize token contracts
    const stETH = await ethers.getContractAt('IERC20Metadata', ethMainnetBetaConfig.STETH_ADDRESS);
    const WETH = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.WETH_ADDRESS);
    const aWETH = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.AWETH_ADDRESS);
    const cWETHv3 = await ethers.getContractAt('IERC20', ethMainnetBetaConfig.CWETH_V3);

    // Grant test tokens to owner and user0
    await grantERC20(owner, WETH, ethers.parseEther('100'));
    await grantERC20(user0, WETH, ethers.parseEther('100'));

    // Grant stETH tokens to owner and user0
    await grantERC20(owner, stETH, ethers.parseEther('100'), FAUCET.stETH);
    await grantERC20(user0, stETH, ethers.parseEther('100'), FAUCET.stETH);

    // Deploy buffer libraries
    const AaveBufferLib = await ethers.getContractFactory('AaveBufferLib');
    const aaveBufferLib = await AaveBufferLib.connect(owner!).deploy();
    const aavePool = ethMainnetBetaConfig.AAVE_POOL;

    const CompoundBufferLib = await ethers.getContractFactory('CompoundBufferLib');
    const compoundBufferLib = await CompoundBufferLib.connect(owner!).deploy();

    // Deploy delegator implementation
    const DelegatorImplementation = await ethers.getContractFactory('Delegator');
    const delegatorImplementation = await DelegatorImplementation.deploy();

    // Calculate future contract addresses for initialization
    const transactionCount = await owner.getNonce();
    const supplyManagerFutureAddress = ethers.getCreateAddress({
        from: owner.address,
        nonce: transactionCount + 2,
    });

    const rebaseERC20V2FutureAddress = ethers.getCreateAddress({
        from: owner.address,
        nonce: transactionCount + 3,
    });

    // Deploy and initialize DepositManager
    const DepositManager = await ethers.getContractFactory('DepositManager');
    const depositManager = await DepositManager.connect(owner!).deploy(
        owner.address,
        owner.address,
        owner.address,
        supplyManagerFutureAddress,
        ethMainnetBetaConfig.WETH_ADDRESS,
        ethMainnetBetaConfig.STRATEGY_FACTORY,
        ethMainnetBetaConfig.DELEGATION_MANAGER,
        await delegatorImplementation.getAddress(),
    );

    // Initialize DepositManager with Aave pool
    await depositManager.initialize(
        0,
        [aavePool],
        [
            {
                poolToken: ethMainnetBetaConfig.AWETH_ADDRESS,
                poolLib: await aaveBufferLib.getAddress(),
                poolPortion: 10_000n,
                poolId: 0,
            },
        ],
        [true],
    );

    // Deploy and initialize SupplyManagerV2
    const SupplyManagerV2 = await ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.connect(owner).deploy(
        owner,
        owner,
        depositManager,
        4000,
        rebaseERC20V2FutureAddress,
    );
    expect(await supplyManagerV2.getAddress()).to.be.equal(supplyManagerFutureAddress);

    // Deploy and initialize RebaseTokenV2
    const RebaseTokenV2 = await ethers.getContractFactory('RebaseTokenV2');
    const rebaseTokenV2 = await RebaseTokenV2.connect(owner).deploy(
        supplyManagerV2,
        owner,
        'Test Molecula Rebase Token V2',
        'TMRTV2',
        18,
        supplyManagerV2,
    );
    expect(await rebaseTokenV2.getAddress()).to.be.equal(rebaseERC20V2FutureAddress);

    const defaultOperator = ethMainnetBetaConfig.EIGENLAYER_OPERATOR;

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
        [ethMainnetBetaConfig.STETH_ADDRESS],
        [ethMainnetBetaConfig.STRATEGY_BASE_STETH],
        [ethers.ZeroAddress],
    );

    // Deploy and initialize token vaults
    const TokenVault = await ethers.getContractFactory('MrEthAssetTokenVault');

    // Deploy and initialize WETH token vault
    const tokenVaultWETH = await TokenVault.connect(owner).deploy(
        owner,
        rebaseTokenV2,
        supplyManagerV2,
        owner!.address,
    );

    await tokenVaultWETH.init(
        WETH,
        10n ** 6n, // Minimum deposit value
        10n ** 18n, // Minimum redeem shares
    );

    // Deploy and initialize stETH token vault
    const tokenVaultStETH = await TokenVault.connect(owner).deploy(
        owner,
        rebaseTokenV2,
        supplyManagerV2,
        owner!.address,
    );

    await tokenVaultStETH.init(
        stETH,
        10n ** 6n, // Minimum deposit value
        10n ** 18n, // Minimum redeem shares
    );

    // Deploy and initialize native token vault
    const NativeTokenVault = await ethers.getContractFactory('MrEthNativeTokenVault');
    const nativeTokenVault = await NativeTokenVault.deploy(
        owner!.address,
        rebaseTokenV2,
        supplyManagerV2,
        owner!.address,
    );

    await nativeTokenVault.init(
        NATIVE_TOKEN,
        10n ** 6n, // Minimum deposit assets
        10n ** 18n, // Minimum redeem shares
    );

    // Add token vaults to whitelist
    const codeHash = keccak256((await tokenVaultWETH.getDeployedCode())!);
    await rebaseTokenV2.setCodeHash(codeHash, true);

    await rebaseTokenV2.addTokenVault(tokenVaultWETH);
    await rebaseTokenV2.addTokenVault(tokenVaultStETH);

    const codeHash2 = keccak256((await nativeTokenVault.getDeployedCode())!);
    await rebaseTokenV2.setCodeHash(codeHash2, true);
    await rebaseTokenV2.addTokenVault(nativeTokenVault);
    await nativeTokenVault.unpauseRequestDeposit();
    await nativeTokenVault.unpauseRequestRedeem();

    // Test token vault addition revert case
    const tokenVaultCWETH_V3 = await TokenVault.connect(owner).deploy(
        owner,
        rebaseTokenV2,
        supplyManagerV2,
        owner!.address,
    );

    await tokenVaultCWETH_V3.init(
        cWETHv3,
        10n ** 6n, // Minimum deposit value
        10n ** 18n, // Minimum redeem shares
    );

    await expect(rebaseTokenV2.addTokenVault(tokenVaultCWETH_V3)).to.be.reverted;

    // Get default delegator
    const defaultDelegatorAddress = await depositManager.chooseDelegatorForDeposit();

    // Get default withdrawal credentials and approve tokens
    const defaultWithdrawalCredentials =
        await depositManager.getWithdrawalCredentials(defaultDelegatorAddress);
    await WETH.approve(tokenVaultWETH, ethers.MaxUint256);
    await WETH.connect(user0).approve(tokenVaultWETH, ethers.MaxUint256);

    await stETH.approve(tokenVaultStETH, ethers.MaxUint256);
    await stETH.connect(user0).approve(tokenVaultStETH, ethers.MaxUint256);

    // Unpause token vaults
    await tokenVaultWETH.unpauseAll();
    await tokenVaultStETH.unpauseAll();

    return {
        depositManager,
        supplyManagerV2,
        rebaseTokenV2,
        tokenVaultWETH,
        tokenVaultStETH,
        nativeTokenVault,
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
    };
}
