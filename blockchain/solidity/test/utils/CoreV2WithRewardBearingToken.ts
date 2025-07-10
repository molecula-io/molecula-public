/* eslint-disable camelcase, max-lines, no-restricted-syntax, no-await-in-loop */
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import { NATIVE_TOKEN } from '../../configs/ethereum/constants';
import { ethMainnetBetaConfig } from '../../configs/ethereum/mainnetBetaTyped';

import { generateRandomWallet } from './Common';

export async function deployCoreV2RewardBearingTokenWithoutInit() {
    const signers = await ethers.getSigners();
    const user0 = await generateRandomWallet();
    const poolOwner = signers.at(1)!;
    const user1 = signers.at(3)!;
    const guardian = signers.at(8)!;
    const operator = signers.at(11)!;
    const yieldDistributor = signers.at(12)!;
    const poolKeeper = await generateRandomWallet();

    const supplyManagerFutureAddress = ethers.getCreateAddress({
        from: poolOwner.address,
        nonce: (await poolOwner.getNonce()) + 1,
    });

    const rebaseERC20V2FutureAddress = ethers.getCreateAddress({
        from: poolOwner.address,
        nonce: (await poolOwner.getNonce()) + 2,
    });

    const USDC = await ethers.getContractAt('IERC20Metadata', ethMainnetBetaConfig.USDC_ADDRESS);
    const USDe = await ethers.getContractAt('IERC20Metadata', ethMainnetBetaConfig.USDE_ADDRESS);

    // deploy mock distributed pool
    const MetaPoolTreasury = await ethers.getContractFactory('MetaPoolTreasury');
    const metaPoolTreasury = await MetaPoolTreasury.connect(poolOwner).deploy(
        poolOwner,
        poolKeeper,
        supplyManagerFutureAddress,
        [],
        guardian,
    );

    // deploy supply manager
    const SupplyManagerV2 = await ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.connect(poolOwner).deploy(
        poolOwner,
        yieldDistributor,
        metaPoolTreasury,
        4000,
        rebaseERC20V2FutureAddress,
    );
    expect(await supplyManagerV2.getAddress()).to.be.equal(supplyManagerFutureAddress);

    // deploy RebaseERC20V2
    const RewardBearingToken = await ethers.getContractFactory('RewardBearingToken');
    const rewardBearingToken = await RewardBearingToken.connect(poolOwner).deploy(
        'Test Molecula Reward Bearing Token',
        'TMRBT',
        poolOwner,
        supplyManagerV2,
        supplyManagerV2,
    );
    expect(await rewardBearingToken.getAddress()).to.be.equal(rebaseERC20V2FutureAddress);

    // deploy TokenVaults
    const TokenVault = await ethers.getContractFactory('MetaERC20TokenVault');
    const usdcVault = await TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rewardBearingToken,
        supplyManagerV2,
        guardian,
    );
    const usdeVault = await TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rewardBearingToken,
        supplyManagerV2,
        guardian,
    );

    const NativeTokenVault = await ethers.getContractFactory('MetaNativeTokenVault');
    const nativeTokenVault = await NativeTokenVault.connect(poolOwner).deploy(
        poolOwner,
        rewardBearingToken,
        supplyManagerV2,
        guardian,
    );

    return {
        user0,
        user1,
        operator,
        rewardBearingToken,
        supplyManagerV2,
        usdcVault,
        usdeVault,
        metaPoolTreasury,
        yieldDistributor,
        poolOwner,
        guardian,
        USDC,
        USDe,
        nativeTokenVault,
    };
}

export async function deployCoreV2RewardBearingToken() {
    const coreV2 = await deployCoreV2RewardBearingTokenWithoutInit();

    // Init TokenVaults
    await coreV2.usdcVault.init(
        coreV2.USDC,
        10n ** 6n, // minDepositAssets
        10n ** 18n, // minRedeemShares
    );
    await coreV2.usdeVault.init(
        coreV2.USDe,
        10n ** 6n, // minDepositAssets
        10n ** 18n, // minRedeemShares
    );
    await coreV2.nativeTokenVault.init(
        NATIVE_TOKEN,
        10n ** 8n, // minDepositAssets
        10n ** 18n, // minRedeemShares
    );

    // Add tokenVault into moleculaRebaseToken's white list
    const codeHash = keccak256((await coreV2.usdcVault.getDeployedCode())!);
    await coreV2.rewardBearingToken.setCodeHash(codeHash, true);
    await coreV2.rewardBearingToken.addTokenVault(coreV2.usdcVault);
    await coreV2.rewardBearingToken.addTokenVault(coreV2.usdeVault);

    const codeHash2 = keccak256((await coreV2.nativeTokenVault.getDeployedCode())!);
    await coreV2.rewardBearingToken.setCodeHash(codeHash2, true);
    await coreV2.rewardBearingToken.addTokenVault(coreV2.nativeTokenVault);

    for (const tokenVault of [coreV2.usdcVault, coreV2.usdeVault, coreV2.nativeTokenVault]) {
        await tokenVault.unpauseRequestDeposit();
        await tokenVault.unpauseRequestRedeem();
    }

    return coreV2;
}
