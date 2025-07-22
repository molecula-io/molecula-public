import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum';

import { getConfig } from '../../utils/deployUtils';

export async function deploywmUSDlmUSD(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    mUSD: string,
) {
    const { account, config } = await getConfig(hre, environment);

    const wmUSDFactory = await hre.ethers.getContractFactory('WMUSDCandy');
    const lmUSDFactory = await hre.ethers.getContractFactory('LMUSD');

    // calc future addresses
    const transactionCount = await account.getNonce();
    const lmUSDFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount + 1,
    });

    const wmUSD = await wmUSDFactory.deploy(
        config.WMUSD_TOKEN_NAME,
        config.WMUSD_TOKEN_SYMBOL,
        config.OWNER,
        mUSD,
        lmUSDFutureAddress,
        {
            gasLimit: DEPLOY_GAS_LIMIT,
        },
    );
    await wmUSD.waitForDeployment();
    console.log('wmUSD: ', await wmUSD.getAddress());

    const lmUSD = await lmUSDFactory.deploy(
        config.LMUSD_TOKEN_NAME,
        config.LMUSD_TOKEN_SYMBOL,
        config.OWNER,
        mUSD,
        wmUSD,
        config.LMUSD_PERIODS,
        config.LMUSD_MULTIPLIERS,
        {
            gasLimit: DEPLOY_GAS_LIMIT,
        },
    );
    await lmUSD.waitForDeployment();
    console.log('lmUSD: ', await lmUSD.getAddress());
    if ((await lmUSD.getAddress()) !== lmUSDFutureAddress) {
        throw new Error(`Unexpected lmUSD address: ${lmUSDFutureAddress}`);
    }

    return {
        wmUSD: await wmUSD.getAddress(),
        lmUSD: await lmUSD.getAddress(),
    };
}
