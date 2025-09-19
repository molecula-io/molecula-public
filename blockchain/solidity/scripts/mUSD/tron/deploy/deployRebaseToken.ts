import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import { waitForDeployment } from './waitForDeployment';

export async function deployRebaseToken(
    hre: HardhatRuntimeEnvironment,
    params: {
        initialOwner: string;
        accountantAddress: string;
        initialShares: bigint;
        oracleAddress: string;
        tokenName: string;
        tokenSymbol: string;
        tokenDecimals: number;
        minDeposit: bigint;
        minRedeem: bigint;
    },
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const artifact = await hre.artifacts.readArtifact('RebaseTokenTron');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 2_000_000_000, // The maximum TRX burns for resource consumption（1TRX = 1,000,000SUN
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            parameters: [
                params.initialOwner,
                params.accountantAddress,
                params.initialShares,
                params.oracleAddress,
                params.tokenName,
                params.tokenSymbol,
                params.tokenDecimals,
                params.minDeposit,
                params.minRedeem,
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
