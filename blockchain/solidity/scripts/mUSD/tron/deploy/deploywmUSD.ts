import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

export async function deploywmUSD(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    params: {
        mUSD: string;
        yieldDistributor?: string;
    },
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const config = getTronEnvironmentConfig(environment);

    const artifact = await hre.artifacts.readArtifact('MoleculaSuppliedWrapperTron');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 2_000_000_000, // The maximum TRX burns for resource consumption（1TRX = 1,000,000SUN
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // name Token's name.
            // symbol Token's symbol.
            // owner Smart contract owner's address.
            // rebaseToken_ Rebase token's address.
            // yieldDistributor_ Authorized Yield Distributor's address.
            parameters: [
                config.WMUSD_TOKEN_NAME,
                config.WMUSD_TOKEN_SYMBOL,
                config.OWNER,
                params.mUSD,
                params.yieldDistributor || config.OWNER, // Owner is a default yieldDistributor!
            ],
        },
        issuerAddress,
    );

    // Send the transactions
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(transaction, hre.tronweb.defaultPrivateKey as string),
    );

    return waitForDeployment(hre.tronweb, transaction);
}
