/* eslint-disable camelcase, max-lines, no-restricted-syntax, no-await-in-loop */
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import { ethMainnetBetaConfig, NATIVE_TOKEN } from '../../configs/ethereum';

import { generateRandomWallet } from './Common';

export async function deployMetaEthWithoutInit() {
    const signers = await ethers.getSigners();
    const user0 = await generateRandomWallet();
    const poolOwner = signers.at(1)!;
    const user1 = signers.at(3)!;
    const randAccount = signers.at(7)!;
    const guardian = signers.at(8)!;
    const operator = signers.at(11)!;
    const yieldDistributor = signers.at(12)!;
    const poolKeeper = await generateRandomWallet();

    const TestSeqnoFactory = await ethers.getContractFactory('TestSeqno');
    const testSeqno = await TestSeqnoFactory.connect(poolOwner).deploy();

    const supplyManagerFutureAddress = ethers.getCreateAddress({
        from: poolOwner.address,
        nonce: (await poolOwner.getNonce()) + 1,
    });

    const rebaseTokenFutureAddress = ethers.getCreateAddress({
        from: poolOwner.address,
        nonce: (await poolOwner.getNonce()) + 2,
    });

    const wETH = await ethers.getContractAt('IERC20Metadata', ethMainnetBetaConfig.WETH_ADDRESS);
    const stETH = await ethers.getContractAt('IERC20Metadata', ethMainnetBetaConfig.STETH_ADDRESS);
    const weETH = await ethers.getContractAt(
        'IERC20Metadata',
        '0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee',
    );
    const rsETH = await ethers.getContractAt(
        'IERC20Metadata',
        '0xA1290d69c65A6Fe4DF752f95823fae25cB99e5A7',
    );
    const ezETH = await ethers.getContractAt(
        'IERC20Metadata',
        '0x7A493Be5c2ce014cD049Bf178a1ac0Db1B434744',
    );

    // deploy mock distributed pool
    const MetaPoolTreasury = await ethers.getContractFactory('MetaPoolTreasury');
    const metaPoolTreasury = await MetaPoolTreasury.connect(poolOwner).deploy(
        poolOwner,
        poolKeeper,
        supplyManagerFutureAddress,
        [testSeqno],
        guardian,
    );

    // deploy supply manager
    const SupplyManagerV2 = await ethers.getContractFactory('SupplyManagerV2WithNative');
    const supplyManagerV2 = await SupplyManagerV2.connect(poolOwner).deploy(
        poolOwner,
        yieldDistributor,
        metaPoolTreasury,
        4000,
        rebaseTokenFutureAddress,
    );
    expect(await supplyManagerV2.getAddress()).to.be.equal(supplyManagerFutureAddress);

    // deploy rebase token
    const RebaseTokenV2 = await ethers.getContractFactory('RebaseTokenV2');
    const rebaseTokenV2 = await RebaseTokenV2.connect(poolOwner).deploy(
        supplyManagerV2,
        poolOwner,
        'Test Molecula Rebase Token V2',
        'TMRTV2',
        18,
        supplyManagerV2,
    );
    expect(await rebaseTokenV2.getAddress()).to.be.equal(rebaseTokenFutureAddress);

    // deploy TokenVaults
    const MetaERC20TokenVault = await ethers.getContractFactory('MetaERC20TokenVault');
    const stETHVault = await MetaERC20TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
        ethers.ZeroAddress,
    );
    const wETHVault = await MetaERC20TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
        ethers.ZeroAddress,
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
        stETHVault,
        wETHVault,
        metaPoolTreasury,
        yieldDistributor,
        poolOwner,
        guardian,
        wETH,
        stETH,
        weETH,
        rsETH,
        ezETH,
        nativeTokenVault,
        poolKeeper,
        testSeqno,
        randAccount,
    };
}

export async function deployMetaEth() {
    const metaEth = await deployMetaEthWithoutInit();

    const minDepositAssets = ethers.parseEther('0.04'); // $100
    const minRedeemShares = 1; // ethers.parseUnits('0.04', 18); //

    // Init TokenVaults
    await metaEth.wETHVault.init(metaEth.wETH, minDepositAssets, minRedeemShares);
    await metaEth.stETHVault.init(metaEth.stETH, minDepositAssets, minRedeemShares);
    await metaEth.nativeTokenVault.init(NATIVE_TOKEN, minDepositAssets, minRedeemShares);

    // Add tokenVault into moleculaRebaseToken's white list
    const codeHash = keccak256((await metaEth.wETHVault.getDeployedCode())!);
    await metaEth.rebaseTokenV2.setCodeHash(codeHash, true);
    await metaEth.rebaseTokenV2.addTokenVault(metaEth.wETHVault);
    await metaEth.rebaseTokenV2.addTokenVault(metaEth.stETHVault);

    const codeHash2 = keccak256((await metaEth.nativeTokenVault.getDeployedCode())!);
    await metaEth.rebaseTokenV2.setCodeHash(codeHash2, true);
    await metaEth.rebaseTokenV2.addTokenVault(metaEth.nativeTokenVault);

    for (const tokenVault of [metaEth.wETHVault, metaEth.stETHVault, metaEth.nativeTokenVault]) {
        await tokenVault.unpauseRequestDeposit();
        await tokenVault.unpauseRequestRedeem();
    }

    return { ...metaEth, minDepositAssets, minRedeemShares };
}
