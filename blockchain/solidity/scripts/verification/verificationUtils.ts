/* eslint-disable @typescript-eslint/no-explicit-any, no-await-in-loop */
import { type HardhatRuntimeEnvironment } from 'hardhat/types';

export async function verifyContract(
    hre: HardhatRuntimeEnvironment,
    contractName: string,
    address: string,
    constructorArguments: any[],
) {
    console.log(`Verifying "${contractName}" at ${address} ...`);
    let verified = true;
    try {
        await hre.run('verify:verify', {
            address,
            constructorArguments,
            contract: contractName,
        });
    } catch (e) {
        console.log(`Failed to verify "${contractName}" with error:`, e);
        verified = false;
    }
    return verified;
}

export async function verifyContractWithRetry(
    hre: HardhatRuntimeEnvironment,
    contractName: string,
    address: string,
    constructorArguments: any[],
    iters = 20,
) {
    console.log(`Trying to verifying "${contractName}" at ${address} ...`);
    for (let i = 0; i < iters; i += 1) {
        console.log(`Attempt ${i + 1}/${iters}`);
        await new Promise<void>(res => {
            setTimeout(res, 5_000); // Wait 5 seconds for explorer to index
        });
        const verified = await verifyContract(hre, contractName, address, constructorArguments);
        if (verified) {
            return;
        }
    }
}
