import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { waitForDeployment } from './waitForDeployment';

export async function deploymUSDLock(
    hre: HardhatRuntimeEnvironment,
    rebaseTokenAddress: string,
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    // TODO the MUSDLock is compiled using solc v0.8.30
    const artifact = await hre.artifacts.readArtifact('MUSDLock');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 2_000_000_000, // The maximum TRX burns for resource consumption（1TRX = 1,000,000SUN
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            parameters: [rebaseTokenAddress],
        },
        issuerAddress,
    );

    // Send the transactions
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(transaction, hre.tronweb.defaultPrivateKey as string),
    );

    return waitForDeployment(hre.tronweb, transaction);
}
