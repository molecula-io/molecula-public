import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { TronWeb } from 'tronweb';

import { waitForDeployment } from './waitForDeployment';

export async function deployOracle(
    hre: HardhatRuntimeEnvironment,
    initialShares: bigint,
    initialPool: bigint,
    initialOwner: string,
    authorizedUpdater: string,
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const artifact = await hre.artifacts.readArtifact('TronOracle');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 1000000000, // The maximum TRX burns for resource consumption（1TRX = 1,000,000SUN
            // @ts-ignore (probably wrong type annotation)
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // @ts-ignore (probably wrong type annotation)
            parameters: [initialShares, initialPool, initialOwner, authorizedUpdater],
        },
        issuerAddress,
    );

    // Send the transactions
    await hre.tronweb.trx.sendRawTransaction(
        await hre.tronweb.trx.sign(transaction, hre.tronweb.defaultPrivateKey as string),
    );

    return waitForDeployment(hre.tronweb, transaction);
}

export async function setAutorizedUpdater(
    tronweb: TronWeb,
    oracleAddress: string,
    accountantAddress: string,
) {
    const senderAddress = tronweb.defaultAddress.base58 as string;

    const functionSelector = 'setAuthorizedUpdater(address)';
    const parameter = [{ type: 'address', value: accountantAddress }];

    // Build transaction
    const response = await tronweb.transactionBuilder.triggerSmartContract(
        tronweb.address.toHex(oracleAddress), // Contract address in hex
        functionSelector,
        { feeLimit: 1000000000 }, // Set fee limit
        parameter,
        senderAddress,
    );

    const { transaction } = response;

    // Sign the transaction
    const signedTransaction = await tronweb.trx.sign(
        transaction,
        tronweb.defaultPrivateKey as string,
    );

    // Send transaction
    await tronweb.trx.sendRawTransaction(signedTransaction);
}
