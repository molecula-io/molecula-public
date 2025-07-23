import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { TronWeb } from 'tronweb';

import { waitForDeployment } from './waitForDeployment';

export async function deployOracle(
    hre: HardhatRuntimeEnvironment,
    tronWeb: TronWeb,
    privateKey: string,
    initialShares: bigint,
    initialPool: bigint,
    initialOwner: string,
    authorizedUpdater: string,
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = tronWeb.address.fromPrivateKey(privateKey);

    if (!issuerAddress) {
        throw new Error('Invalid private key');
    }

    const artifact = await hre.artifacts.readArtifact('TronOracle');

    const transaction = await tronWeb.transactionBuilder.createSmartContract(
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
    await tronWeb.trx.sendRawTransaction(await tronWeb.trx.sign(transaction, privateKey));

    return waitForDeployment(tronWeb, transaction);
}

export async function setAutorizedUpdater(
    tronWeb: TronWeb,
    privateKey: string,
    oracleAddress: string,
    accountantAddress: string,
) {
    const senderAddress = tronWeb.address.fromPrivateKey(privateKey);

    if (!senderAddress) {
        throw new Error('Invalid private key');
    }

    const functionSelector = 'setAuthorizedUpdater(address)';
    const parameter = [{ type: 'address', value: accountantAddress }];

    // Build transaction
    const response = await tronWeb.transactionBuilder.triggerSmartContract(
        tronWeb.address.toHex(oracleAddress), // Contract address in hex
        functionSelector,
        { feeLimit: 1000000000 }, // Set fee limit
        parameter,
        senderAddress,
    );

    const { transaction } = response;

    // Sign the transaction
    const signedTransaction = await tronWeb.trx.sign(transaction, privateKey);

    // Send transaction
    await tronWeb.trx.sendRawTransaction(signedTransaction);
}
