import { type HardhatRuntimeEnvironment } from 'hardhat/types';
import type { TronWeb } from 'tronweb';

import { waitForDeployment } from './waitForDeployment';

export async function deployAccountantLZ(
    hre: HardhatRuntimeEnvironment,
    params: {
        initialOwner: string;
        authorizedLZConfiguratorAddress: string;
        endpoint: string;
        lzDstEid: number;
        usdtAddress: string;
        usdtOFTAddress: string;
        oracleAddress: string;
    },
): Promise<string> {
    // Find an account address corresponding to the given PRIVATE_KEY
    const issuerAddress = hre.tronweb.defaultAddress.base58 as string;

    const artifact = await hre.artifacts.readArtifact('AccountantLZ');

    const transaction = await hre.tronweb.transactionBuilder.createSmartContract(
        {
            feeLimit: 5000000000, // The maximum TRX burns for resource consumption（1TRX = 1,000,000SUN
            // @ts-ignore (probably wrong type annotation)
            abi: artifact.abi,
            bytecode: artifact.bytecode,
            // @ts-ignore (probably wrong type annotation)
            parameters: [
                params.initialOwner,
                params.authorizedLZConfiguratorAddress,
                params.endpoint,
                params.lzDstEid,
                params.usdtAddress,
                params.usdtOFTAddress,
                params.oracleAddress,
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

export async function setUnderlyingToken(
    tronweb: TronWeb,
    params: {
        accountantLZ: string;
        moleculaToken: string;
    },
) {
    const senderAddress = tronweb.defaultAddress.base58 as string;

    const functionSelector = 'setUnderlyingToken(address)';
    const parameter = [{ type: 'address', value: params.moleculaToken }];

    // Build transaction
    const response = await tronweb.transactionBuilder.triggerSmartContract(
        tronweb.address.toHex(params.accountantLZ), // Contract address in hex
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
