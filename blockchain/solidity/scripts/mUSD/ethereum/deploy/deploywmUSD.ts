import type { AddressLike } from 'ethers';
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../../configs';

import { getConfig } from '../../../utils/deployUtils';
import { verifyContractWithRetry } from '../../../verificationUtils';

export async function deploywmUSD(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    params: {
        mUSD: string;
        yieldDistributor?: string;
    },
) {
    const { config } = await getConfig(hre, environment);

    const WMUSD = await hre.ethers.getContractFactory('MoleculaSuppliedWrapper');

    console.log('Deploying wmUSD...');
    const constructorArguments: [string, string, AddressLike, AddressLike, AddressLike] = [
        config.WMUSD_TOKEN_NAME,
        config.WMUSD_TOKEN_SYMBOL,
        config.OWNER,
        params.mUSD,
        params.yieldDistributor || config.OWNER, // Owner is a default yieldDistributor!
    ];

    const wmUSD = await WMUSD.deploy(...constructorArguments, { gasLimit: DEPLOY_GAS_LIMIT });
    await wmUSD.waitForDeployment();

    const wmUSDAddress = await wmUSD.getAddress();
    console.log('wmUSD: ', wmUSDAddress);

    await verifyContractWithRetry(
        hre,
        'contracts/coreV2/WrappedTokens/MoleculaSuppliedWrapper.sol:MoleculaSuppliedWrapper',
        wmUSDAddress,
        constructorArguments,
    );

    return wmUSDAddress;
}

export async function deploylmUSD(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    params: {
        mUSD: string;
        wmUSD: string;
    },
) {
    const { config } = await getConfig(hre, environment);

    const LMUSD = await hre.ethers.getContractFactory('LMUSD');

    console.log('Deploying lmUSD...');
    const lmUSD = await LMUSD.deploy(
        config.LMUSD_TOKEN_NAME,
        config.LMUSD_TOKEN_SYMBOL,
        config.OWNER,
        params.mUSD,
        params.wmUSD,
        config.LMUSD_PERIODS,
        config.LMUSD_MULTIPLIERS,
        {
            gasLimit: DEPLOY_GAS_LIMIT,
        },
    );
    await lmUSD.waitForDeployment();
    console.log('lmUSD: ', await lmUSD.getAddress());

    return lmUSD.getAddress();
}
