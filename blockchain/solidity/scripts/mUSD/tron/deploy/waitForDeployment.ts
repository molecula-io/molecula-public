import type { TronWeb, Types } from 'tronweb';

// Wait for the smart-contract deployment
export async function waitForDeployment(
    tronWeb: TronWeb,
    transaction: Types.CreateSmartContractTransaction,
): Promise<string> {
    console.log('waiting for 5s ...');
    // Sleep for 5 seconds
    // Wait to ensure that the transaction appears in the scanner.
    // eslint-disable-next-line no-promise-executor-return
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for the transaction
    const tx = await tronWeb.trx.getTransaction(transaction.txID);

    // Check if the transaction has any data
    if (Object.keys(tx).length > 0) {
        // Should be deployed
        return tronWeb.address.fromHex(transaction.contract_address);
    }
    // Retry in 3 seconds
    console.log('waiting for 3s ...');
    // eslint-disable-next-line no-promise-executor-return
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Recursive call to function
    return waitForDeployment(tronWeb, transaction);
}
