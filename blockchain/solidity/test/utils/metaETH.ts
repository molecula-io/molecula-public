/* eslint-disable camelcase, max-lines, no-restricted-syntax, no-await-in-loop */
import { expect } from 'chai';
import { keccak256 } from 'ethers';
import { ethers } from 'hardhat';

import {
    chainLinkFeeds,
    EVMChainIDs,
    evmStaticTokenAddresses,
} from '@molecula-monorepo/blockchain.addresses';

import { ETH_VIRTUAL_OFFSET, NATIVE_TOKEN } from '../../configs';

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
    const virtualOffset = ETH_VIRTUAL_OFFSET;

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

    const wETH = await ethers.getContractAt(
        'IERC20Metadata',
        evmStaticTokenAddresses.wETH[EVMChainIDs.Mainnet],
    );
    const stETH = await ethers.getContractAt(
        'IERC20Metadata',
        evmStaticTokenAddresses.stETH[EVMChainIDs.Mainnet],
    );

    // TODO add to molecula pool
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

    const approveSelector = stETH.interface.getFunction('approve').selector;

    // deploy mock distributed pool
    const MetaPoolTreasury = await ethers.getContractFactory('MetaPoolTreasury');
    const metaPoolTreasury = await MetaPoolTreasury.connect(poolOwner).deploy(
        poolOwner,
        poolKeeper,
        supplyManagerFutureAddress,
        [{ target: testSeqno, selector: approveSelector }],
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
        rebaseTokenFutureAddress,
        virtualOffset,
    );
    expect(await supplyManagerV2.getAddress()).to.be.equal(supplyManagerFutureAddress);

    const rebaseTokenV2Decimals = 18;

    // deploy rebase token
    const RebaseTokenV2 = await ethers.getContractFactory('RebaseTokenV2');
    const rebaseTokenV2 = await RebaseTokenV2.connect(poolOwner).deploy(
        supplyManagerV2,
        poolOwner,
        'Test Molecula Rebase Token V2',
        'TMRTV2',
        rebaseTokenV2Decimals,
        supplyManagerV2,
    );
    expect(await rebaseTokenV2.getAddress()).to.be.equal(rebaseTokenFutureAddress);

    const RewardBearingWrapper = await ethers.getContractFactory('RewardBearingWrapper');
    const wmetaETH = await RewardBearingWrapper.connect(poolOwner).deploy(
        'Wrapped metaETH',
        'wmetaETH',
        rebaseTokenV2,
    );

    // deploy TokenVaults
    const MetaERC20TokenVault = await ethers.getContractFactory('MetaERC20TokenVault');
    const stETHVault = await MetaERC20TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
    );

    // TODO another token vault
    const wETHVault = await MetaERC20TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
    );
    const weETHVault = await MetaERC20TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
    );
    const rsETHVault = await MetaERC20TokenVault.connect(poolOwner).deploy(
        poolOwner,
        rebaseTokenV2,
        supplyManagerV2,
        guardian,
    );
    const ezETHVault = await MetaERC20TokenVault.connect(poolOwner).deploy(
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

    // STETH / ETH
    const stETHFeed = chainLinkFeeds.eth.stETH[EVMChainIDs.Mainnet];
    const weETHFeed = chainLinkFeeds.eth.weETH[EVMChainIDs.Mainnet];
    const rsETHFeed = chainLinkFeeds.eth.rsETH[EVMChainIDs.Mainnet];
    const ezETHFeed = chainLinkFeeds.eth.ezETH[EVMChainIDs.Mainnet];
    const PriceChecker = await ethers.getContractFactory('PriceChecker');
    const priceChecker = await PriceChecker.connect(poolOwner).deploy(
        [
            {
                asset: stETH,
                priceFeed: stETHFeed.address,
                priceDeviationBps: 50, // 0.5 %
                stalenessThreshold: stETHFeed.heartbeat,
            },
            {
                asset: wETH,
                priceFeed: ethers.ZeroAddress,
                priceDeviationBps: 0,
                stalenessThreshold: 0,
            },
            {
                asset: NATIVE_TOKEN,
                priceFeed: ethers.ZeroAddress,
                priceDeviationBps: 0,
                stalenessThreshold: 0,
            },
            {
                asset: weETH,
                priceFeed: weETHFeed.address,
                priceDeviationBps: 50, // 0.5 %
                stalenessThreshold: weETHFeed.heartbeat,
            },
            {
                asset: rsETH,
                priceFeed: rsETHFeed.address,
                priceDeviationBps: 50, // 0.5 %
                stalenessThreshold: rsETHFeed.heartbeat,
            },
            {
                asset: ezETH,
                priceFeed: ezETHFeed.address,
                priceDeviationBps: 50, // 0.5 %
                stalenessThreshold: ezETHFeed.heartbeat,
            },
        ],
        poolOwner,
        rebaseTokenV2Decimals,
    );
    await metaPoolTreasury.setPriceChecker(priceChecker);

    return {
        user0,
        user1,
        operator,
        rebaseTokenV2,
        supplyManagerV2,
        stETHVault,
        wETHVault,
        weETHVault,
        rsETHVault,
        ezETHVault,
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
        wmetaETH,
        approveSelector,
    };
}

export async function deployMetaEth() {
    const metaEth = await deployMetaEthWithoutInit();

    const minDepositAssets = ethers.parseEther('0.04'); // $100
    const minRedeemShares = 1; // ethers.parseUnits('0.04', 18); //

    // Init TokenVaults
    await metaEth.wETHVault.init(metaEth.wETH, minDepositAssets, minRedeemShares);
    await metaEth.stETHVault.init(metaEth.stETH, minDepositAssets, minRedeemShares);
    // TODO
    // await metaEth.weETHVault.init(metaEth.weETH, minDepositAssets, minRedeemShares);
    // await metaEth.rsETHVault.init(metaEth.rsETH, minDepositAssets, minRedeemShares);
    // await metaEth.ezETHVault.init(metaEth.ezETH, minDepositAssets, minRedeemShares);
    await metaEth.nativeTokenVault.init(NATIVE_TOKEN, minDepositAssets, minRedeemShares);

    // Add tokenVault into moleculaRebaseToken's whitelist
    const codeHash = keccak256((await metaEth.wETHVault.getDeployedCode())!);
    await metaEth.rebaseTokenV2.setCodeHash(codeHash, true);
    await metaEth.rebaseTokenV2.addTokenVault(metaEth.wETHVault);
    await metaEth.rebaseTokenV2.addTokenVault(metaEth.stETHVault);
    // TODO
    // await metaEth.rebaseTokenV2.addTokenVault(metaEth.weETHVault);
    // await metaEth.rebaseTokenV2.addTokenVault(metaEth.rsETHVault);
    // await metaEth.rebaseTokenV2.addTokenVault(metaEth.ezETHVault);

    const codeHash2 = keccak256((await metaEth.nativeTokenVault.getDeployedCode())!);
    await metaEth.rebaseTokenV2.setCodeHash(codeHash2, true);
    await metaEth.rebaseTokenV2.addTokenVault(metaEth.nativeTokenVault);

    for (const tokenVault of [
        metaEth.wETHVault,
        metaEth.stETHVault,
        metaEth.nativeTokenVault,
        metaEth.weETHVault,
        metaEth.rsETHVault,
        metaEth.ezETHVault,
    ]) {
        await tokenVault.unpauseRequestDeposit();
        await tokenVault.unpauseRequestRedeem();
    }

    return { ...metaEth, minDepositAssets, minRedeemShares };
}
