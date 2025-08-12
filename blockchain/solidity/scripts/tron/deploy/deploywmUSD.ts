import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import {
    type ContractsCarbon,
    type EnvironmentType,
} from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig } from '../../utils/deployUtils';

import { waitForDeployment } from './waitForDeployment';

export async function deploywmUSD(
    hre: HardhatRuntimeEnvironment,
    contractsCarbon: ContractsCarbon,
    environment: EnvironmentType,
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const config = getTronEnvironmentConfig(environment);

    const artifact = await hre.artifacts.readArtifact('WmUSDTron');

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
                config.WMUSD_NAME,
                config.WMUSD_SYMBOL,
                config.OWNER,
                contractsCarbon.tron.rebaseToken,
                config.OWNER, // NOTE: yieldDistributor is the owner!
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
