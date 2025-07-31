import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { waitForDeployment } from './waitForDeployment';

export async function deploymUSDLock(
    hre: HardhatRuntimeEnvironment,
    rebaseTokenAddress: string,
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const artifact = await hre.artifacts.readArtifact('MUSDLock');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 2000000000, // The maximum TRX burns for resource consumption（1TRX = 1,000,000SUN
            // @ts-ignore (probably wrong type annotation)
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // @ts-ignore (probably wrong type annotation)
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
