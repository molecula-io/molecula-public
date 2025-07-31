import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsExecutor, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../utils/deployUtils';

/**
 * This script is for test/devnet use only.
 * It synchronizes the Custom Executor contract's per-destination config from the LZ Executor.
 */
export async function syncExecutorParams(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    const contractsExecutor: ContractsExecutor = await readFromFile(
        `${environment}/contracts_executor.json`,
    );
    const config = getTronEnvironmentConfig(environment);

    // get owner
    console.log('Initial owner:', hre.tronweb.defaultAddress.base58);

    // Get the deployed Executor contract address for Tron (Shasta)
    const executorLzAddress = hre.tronweb.address.fromHex(config.LAYER_ZERO_TRON_EXECUTOR);

    // Instantiate the LZ Executor contract object
    const artifact = await hre.artifacts.readArtifact('Executor');
    const executorLz = hre.tronweb.contract(artifact.abi, executorLzAddress);

    // @ts-ignore (TronWeb typings for contract calls are incomplete)
    const dstConfig = await executorLz.methods.dstConfig(config.LAYER_ZERO_ETHEREUM_EID).call();
    console.log('Current LZ destination config:', dstConfig);

    // Get the deployed Executor contract address for Tron (Shasta)
    const executorAddress = hre.tronweb.address.fromHex(contractsExecutor.tron.executor);

    // Instantiate the Executor contract object
    const executor = hre.tronweb.contract(artifact.abi, executorAddress);

    // Set the WorkerFeeLib contract address for the Executor (enables fee computation)
    // @ts-ignore (TronWeb typings for contract calls are incomplete)
    const tx = await executor.methods.setWorkerFeeLib(contractsExecutor.tron.executorFeeLib).send();
    console.log('ExecutorFeeLib setup transaction:', tx);

    // Prepare and send destination configuration update.
    // The array corresponds to: [
    //   dstEid, lzReceiveBaseGas, lzComposeBaseGas, multiplierBps, floorMarginUSD, nativeCap
    // ]
    // All values must be passed as strings (TronWeb limitation).
    const dstConfigWithEid = [
        config.LAYER_ZERO_ETHEREUM_EID, // dstEid
        String(dstConfig[0]), // lzReceiveBaseGas
        String(dstConfig[4]), // lzComposeBaseGas
        String(dstConfig[1]), // multiplierBps
        String(dstConfig[2]), // floorMarginUSD
        String(dstConfig[3]), // nativeCap
    ];
    // @ts-ignore (TronWeb typings for contract calls are incomplete)
    const setConfigTx = await executor.methods.setDstConfig([dstConfigWithEid]).send();
    console.log('Set config transaction:', setConfigTx);
}
