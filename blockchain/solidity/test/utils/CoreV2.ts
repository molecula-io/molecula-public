/* eslint-disable camelcase, max-lines, no-restricted-syntax, no-await-in-loop */
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig, NATIVE_TOKEN } from '../../configs';

import { generateRandomWallet } from './Common';

export async function deployCoreV2WithoutInit() {
    const signers = await ethers.getSigners();
    const user0 = await generateRandomWallet();
    const poolOwner = signers.at(1)!;
    const user1 = signers.at(3)!;
    const guardian = signers.at(8)!;
    const operator = signers.at(11)!;
    const yieldDistributor = signers.at(12)!;
    const poolKeeper = await generateRandomWallet();
    const virtualOffset = 10n ** 18n; // Note: it's for USD solution

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
        ethers.ZeroAddress,
    );

    // deploy supply manager
    const SupplyManagerV2 = await ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.connect(poolOwner).deploy(
        poolOwner,
        yieldDistributor,
        metaPoolTreasury,
        4000,
        rebaseERC20V2FutureAddress,
        virtualOffset,
    );
    expect(await supplyManagerV2.getAddress()).to.be.equal(supplyManagerFutureAddress);

    // deploy RebaseERC20V2
    const RebaseTokenV2 = await ethers.getContractFactory('RebaseTokenV2');
    const rebaseTokenV2 = await RebaseTokenV2.connect(poolOwner).deploy(
        supplyManagerV2,
        poolOwner,
        'Test Molecula Rebase Token V2',
        'TMRTV2',
        18,
        supplyManagerV2,
    );
    expect(await rebaseTokenV2.getAddress()).to.be.equal(rebaseERC20V2FutureAddress);

    // deploy TokenVaults
    const TokenVault = await ethers.getContractFactory('MetaERC20TokenVault');
    const usdcVault = await TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
    );
    const usdeVault = await TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
    );

    const NativeTokenVault = await ethers.getContractFactory('MetaNativeTokenVault');
    const nativeTokenVault = await NativeTokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
    );

    return {
        user0,
        user1,
        operator,
        rebaseTokenV2,
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
        virtualOffset,
    };
}

export async function deployCoreV2() {
    const coreV2 = await deployCoreV2WithoutInit();

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

    // Add tokenVault into moleculaRebaseToken's whitelist
    const codeHash = keccak256((await coreV2.usdcVault.getDeployedCode())!);
    await coreV2.rebaseTokenV2.setCodeHash(codeHash, true);
    await coreV2.rebaseTokenV2.addTokenVault(coreV2.usdcVault);
    await coreV2.rebaseTokenV2.addTokenVault(coreV2.usdeVault);

    const codeHash2 = keccak256((await coreV2.nativeTokenVault.getDeployedCode())!);
    await coreV2.rebaseTokenV2.setCodeHash(codeHash2, true);
    await coreV2.rebaseTokenV2.addTokenVault(coreV2.nativeTokenVault);

    for (const tokenVault of [coreV2.usdcVault, coreV2.usdeVault, coreV2.nativeTokenVault]) {
        await tokenVault.unpauseRequestDeposit();
        await tokenVault.unpauseRequestRedeem();
    }

    return coreV2;
}

export async function deployCoreV2WithRedeemController() {
    const coreV2 = await deployCoreV2();

    // Deploy Redeem Controller
    const RedeemController = await ethers.getContractFactory('RedeemController');
    const redeemController = await RedeemController.connect(coreV2.user0).deploy(
        coreV2.supplyManagerV2,
    );

    return {
        ...coreV2,
        redeemController,
    };
}
