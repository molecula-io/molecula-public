/* eslint-disable camelcase, max-lines, no-restricted-syntax, no-await-in-loop */

import * as hre from 'hardhat';

import { type EVMAddress, EVMChainIDs } from '@molecula-monorepo/blockchain.addresses';

import { metaEthMainnetBetaConfig } from '../../configs';

import { deployAndInitMetaEth } from '../../scripts';

import { generateRandomWallet } from './Common';

export async function deployMetaEth() {
    const signers = await hre.ethers.getSigners();
    const user0 = await generateRandomWallet();
    const deployer = signers.at(0)!;
    const poolOwner = signers.at(1)!;
    const user1 = signers.at(3)!;
    const randAccount = signers.at(7)!;
    const guardian = signers.at(8)!;
    const operator = signers.at(11)!;
    const yieldDistributor = signers.at(12)!;
    const poolKeeper = await generateRandomWallet();

    const TestSeqnoFactory = await hre.ethers.getContractFactory('TestSeqno');
    const testSeqno = await TestSeqnoFactory.connect(poolOwner).deploy();

    const config = metaEthMainnetBetaConfig;

    const wETH = await hre.ethers.getContractAt('IERC20Metadata', config.wETH);
    const stETH = await hre.ethers.getContractAt('IERC20Metadata', config.stETH);
    const weETH = await hre.ethers.getContractAt('IERC20Metadata', config.weETH);
    const rsETH = await hre.ethers.getContractAt('IERC20Metadata', config.rsETH);
    const ezETH = await hre.ethers.getContractAt('IERC20Metadata', config.ezETH);

    const chainId = EVMChainIDs.Mainnet;
    config.OWNER = poolOwner.address as EVMAddress;
    config.POOL_KEEPER = poolKeeper.address as EVMAddress;
    config.YIELD_DISTRIBUTOR = yieldDistributor.address as EVMAddress;
    config.GUARDIAN = guardian.address as EVMAddress;

    const result = await deployAndInitMetaEth(hre, config, deployer, chainId, true);

    const rebaseTokenV2 = await hre.ethers.getContractAt('RebaseTokenV2', result.rebaseTokenV2);

    const RewardBearingWrapper = await hre.ethers.getContractFactory('RewardBearingWrapper');
    const wmetaETH = await RewardBearingWrapper.connect(poolOwner).deploy(
        'Wrapped metaETH',
        'wmetaETH',
        rebaseTokenV2,
    );

    const approveSelector = stETH.interface.getFunction('approve').selector;

    const metaPoolTreasury = await hre.ethers.getContractAt(
        'MetaPoolTreasury',
        result.metaPoolTreasury,
        poolOwner,
    );
    await metaPoolTreasury.addInWhiteList(testSeqno, approveSelector);

    const supplyManagerV2 = await hre.ethers.getContractAt(
        'SupplyManagerV2',
        result.supplyManagerV2,
        poolOwner,
    );
    const stETHVault = await hre.ethers.getContractAt(
        'MetaERC20TokenVault',
        result.stETHVault,
        poolOwner,
    );
    const wETHVault = await hre.ethers.getContractAt(
        'MetaERC20TokenVault',
        result.wETHVault,
        poolOwner,
    );
    const nativeTokenVault = await hre.ethers.getContractAt(
        'MetaNativeTokenVault',
        result.nativeTokenVault,
        poolOwner,
    );
    const weETHVault = await hre.ethers.getContractAt(
        'MetaERC20TokenVault',
        result.weETHVault,
        poolOwner,
    );
    const rsETHVault = await hre.ethers.getContractAt(
        'MetaERC20TokenVault',
        result.rsETHVault,
        poolOwner,
    );
    const ezETHVault = await hre.ethers.getContractAt(
        'MetaERC20TokenVault',
        result.ezETHVault,
        poolOwner,
    );

    await stETHVault.acceptOwnership();
    await wETHVault.acceptOwnership();
    await nativeTokenVault.acceptOwnership();
    await weETHVault.acceptOwnership();
    await rsETHVault.acceptOwnership();
    await ezETHVault.acceptOwnership();

    return {
        supplyManagerV2,
        stETHVault,
        wETHVault,
        nativeTokenVault,
        weETHVault,
        rsETHVault,
        ezETHVault,
        user0,
        user1,
        operator,
        rebaseTokenV2,
        metaPoolTreasury,
        yieldDistributor,
        poolOwner,
        guardian,
        wETH,
        stETH,
        weETH,
        rsETH,
        ezETH,
        poolKeeper,
        testSeqno,
        randAccount,
        wmetaETH,
        approveSelector,

        minDepositAssets: config.MIN_DEPOSIT_ETH,
    };
}
