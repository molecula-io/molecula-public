import type { AddressLike } from 'ethers';

import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EVMAddress, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../../configs';

import { getConfig, increaseBalance } from '../../../utils/deployUtils';

async function deploymUSDe(
    hre: HardhatRuntimeEnvironment,
    stakedUSDe: AddressLike,
    owner: AddressLike,
) {
    // deploy mUSDe
    const musdeFactory = await hre.ethers.getContractFactory('MUSDE');
    const musde = await musdeFactory.deploy(stakedUSDe, owner, { gasLimit: DEPLOY_GAS_LIMIT });
    await musde.waitForDeployment();
    const musdeAddress = await musde.getAddress();
    console.log('mUSDe deployed: ', musdeAddress);

    return musdeAddress;
}

export async function deployCore(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    nomusde: boolean,
) {
    const { config, account, USDT } = await getConfig(hre, environment);

    // deploy mUSDe
    const mUSDe = nomusde ? '' : await deploymUSDe(hre, config.SUSDE_ADDRESS, config.POOL_KEEPER);
    console.log('mUSDe address: ', mUSDe);

    // Pool keeper is already deployed
    const poolKeeper = config.POOL_KEEPER;

    // add mUSDe to token array
    const tokens = config.MOLECULA_POOL_TOKENS;
    if (mUSDe !== '') {
        tokens.push({ token: mUSDe as EVMAddress, n: 0 });
    }
    console.log('tokens:', tokens);

    // deploy moleculaPool
    const supplyManagerFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: (await account.getNonce()) + 2, // deploy moleculaPool + transfer tokens
    });
    const MoleculaPoolFactoryV2 = await hre.ethers.getContractFactory('MoleculaPoolTreasuryV2');
    if (config.GUARDIAN_ADDRESS === '0x') {
        throw new Error(`Set guardian address in config.`);
    }
    const moleculaPoolV2 = await MoleculaPoolFactoryV2.deploy(
        config.INITIAL_USDT_SUPPLY * 10n ** 12n,
        account.address,
        tokens.map(x => x.token),
        poolKeeper,
        supplyManagerFutureAddress,
        config.WHITE_LIST,
        config.GUARDIAN_ADDRESS,
        hre.ethers.ZeroAddress,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await moleculaPoolV2.waitForDeployment();
    console.log('MoleculaPoolTreasuryV2 address: ', await moleculaPoolV2.getAddress());
    await increaseBalance(
        'MoleculaPoolTreasuryV2',
        await moleculaPoolV2.getAddress(),
        config.INITIAL_USDT_SUPPLY,
        USDT,
    );

    // deploy supply manager
    const SupplyManager = await hre.ethers.getContractFactory('SupplyManager');
    const supplyManager = await SupplyManager.deploy(
        account.address, // In the end set owner to pool_keeper
        poolKeeper,
        await moleculaPoolV2.getAddress(),
        config.APY_FORMATTER,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await supplyManager.waitForDeployment();
    console.log('SupplyManager address: ', await supplyManager.getAddress());
    if ((await supplyManager.getAddress()) !== supplyManagerFutureAddress) {
        console.error(
            'SupplyManager address not equal to precalculated address: ',
            supplyManagerFutureAddress,
        );
        process.exit(1);
    }
    if ((await moleculaPoolV2.SUPPLY_MANAGER()) !== supplyManagerFutureAddress) {
        console.error(
            "MoleculaPool's SupplyManager address not equal to deployed SupplyManager: ",
            supplyManagerFutureAddress,
        );
        process.exit(1);
    }

    // print addresses
    console.log('Block #', await hre.ethers.provider.getBlockNumber());
    console.log('MoleculaPool address: ', await moleculaPoolV2.getAddress());
    console.log('SupplyManager address: ', await supplyManager.getAddress());
    console.log('Pool keeper: ', poolKeeper);
    console.log('mUSDe deployed: ', mUSDe);

    return {
        supplyManager: await supplyManager.getAddress(),
        moleculaPool: await moleculaPoolV2.getAddress(),
        poolKeeper,
        mUSDe,
        ethena: {
            USDe: config.USDE_ADDRESS,
            sUSDe: config.SUSDE_ADDRESS,
        },
    };
}
