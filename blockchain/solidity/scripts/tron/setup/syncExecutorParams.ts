import type { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TronWeb } from 'tronweb';

import type { ContractsExecutor, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getTronEnvironmentConfig, readFromFile } from '../../utils/deployUtils';

/**
 * This script is for test/devnet use only.
 * It synchronizes the Custom Executor contract's per-destination config from the LZ Executor.
 */
export async function syncExecutorParams(
    hre: HardhatRuntimeEnvironment,
    mnemonic: string,
    path: string,
    environment: EnvironmentType,
) {
    const contractsExecutor: ContractsExecutor = await readFromFile(
        `${environment}/contracts_executor.json`,
    );
    const config = getTronEnvironmentConfig(environment);

    // Initialize TronWeb instance for interacting with Tron network
    const tronWeb = new TronWeb({
        fullHost: config.RPC_URL,
    });

    // Derive account from mnemonic phrase (read from env)
    const accountInfo = tronWeb.fromMnemonic(mnemonic, path);
    if (accountInfo instanceof Error) {
        throw new Error('Invalid account information returned from fromMnemonic.');
    }

    // Strip "0x" if present and set as signing key for TronWeb
    const privateKey = accountInfo.privateKey.substring(2);
    tronWeb.setPrivateKey(privateKey);

    // Get the deployed Executor contract address for Tron (Shasta)
    const executorLzAddress = tronWeb.address.fromHex(config.LAYER_ZERO_TRON_EXECUTOR);

    // Instantiate the LZ Executor contract object
    const artifact = await hre.artifacts.readArtifact('Executor');
    const executorLz = tronWeb.contract(artifact.abi, executorLzAddress);

    // @ts-ignore (TronWeb typings for contract calls are incomplete)
    const dstConfig = await executorLz.methods.dstConfig(config.LAYER_ZERO_ETHEREUM_EID).call();
    console.log('Current LZ destination config:', dstConfig);

    // Get the deployed Executor contract address for Tron (Shasta)
    const executorAddress = tronWeb.address.fromHex(contractsExecutor.tron.executor);

    // Instantiate the Executor contract object
    const executor = tronWeb.contract(artifact.abi, executorAddress);

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
