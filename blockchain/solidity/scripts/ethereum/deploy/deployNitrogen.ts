import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum/constants';

import { getConfig, increaseBalance } from '../../utils/deployUtils';

export async function deployNitrogen(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    contractsCore: {
        mUSDe: string;
        moleculaPool: string;
        supplyManager: string;
    },
) {
    const { config, account, USDT } = await getConfig(hre, environment);

    // deploy mUSDe
    const { mUSDe } = contractsCore;
    console.log('mUSDe address: ', mUSDe);

    // Pool keeper is already deployed
    const poolKeeper = config.POOL_KEEPER;

    // Get moleculaPool address
    const { moleculaPool } = contractsCore;
    console.log('MoleculaPool address: ', moleculaPool);

    // if moleculaPool do not have USDT then transfer it
    await increaseBalance('moleculaPool', moleculaPool, config.INITIAL_USDT_SUPPLY, USDT);

    // calc future addresses
    const transactionCount = await account.getNonce();
    const rebaseTokenFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount + 1,
    });

    // deploy agent accountant
    const Agent = await hre.ethers.getContractFactory('AccountantAgent');
    const agent = await Agent.deploy(
        account.address,
        rebaseTokenFutureAddress,
        contractsCore.supplyManager,
        config.USDT_ADDRESS,
        config.GUARDIAN_ADDRESS,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await agent.waitForDeployment();
    console.log('Agent address: ', await agent.getAddress());

    // deploy supply manager
    const supplyManager = await hre.ethers.getContractAt(
        'SupplyManager',
        contractsCore.supplyManager,
    );
    console.log('SupplyManager address: ', await supplyManager.getAddress());

    // deploy Rebase Token
    const RebaseToken = await hre.ethers.getContractFactory('RebaseToken');
    const rebaseToken = await RebaseToken.deploy(
        account.address,
        await agent.getAddress(),
        await supplyManager.totalSharesSupply(),
        await supplyManager.getAddress(),
        config.MUSD_TOKEN_NAME,
        config.MUSD_TOKEN_SYMBOL,
        config.MUSD_TOKEN_DECIMALS,
        config.MUSD_TOKEN_MIN_DEPOSIT,
        config.MUSD_TOKEN_MIN_REDEEM,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await rebaseToken.waitForDeployment();
    console.log('RebaseToken address: ', await rebaseToken.getAddress());
    if ((await rebaseToken.getAddress()) !== rebaseTokenFutureAddress) {
        console.error(
            'RebaseToken address not equal to precalculated address: ',
            rebaseTokenFutureAddress,
        );
        process.exit(1);
    }

    // set agent to supply manager
    const tx = await supplyManager.setAgent(await agent.getAddress(), true);
    await tx.wait();
    console.log('Agent set to supply manager');

    // deploy musdLock
    const musdLockFactory = await hre.ethers.getContractFactory('MUSDLock');
    const musdLock = await musdLockFactory.deploy(await rebaseToken.getAddress(), {
        gasLimit: DEPLOY_GAS_LIMIT,
    });
    await musdLock.waitForDeployment();

    // print addresses
    console.log('Block #', await hre.ethers.provider.getBlockNumber());
    console.log('Agent address: ', await agent.getAddress());
    console.log('RebaseToken address: ', await rebaseToken.getAddress());
    console.log('MoleculaPool address: ', moleculaPool);
    console.log('SupplyManager address: ', await supplyManager.getAddress());
    console.log('Pool keeper: ', poolKeeper);
    console.log('mUSDLock: ', await musdLock.getAddress());
    console.log('mUSDe deployed: ', mUSDe);

    return {
        supplyManager: await supplyManager.getAddress(),
        moleculaPool,
        accountantAgent: await agent.getAddress(),
        rebaseToken: await rebaseToken.getAddress(),
        poolKeeper,
        mUSDLock: await musdLock.getAddress(),
        mUSDe,
        rebaseTokenOwner: '',
        tokenVaults: {},
        ethena: {
            USDe: config.USDE_ADDRESS,
            sUSDe: config.SUSDE_ADDRESS,
        },
    };
}
