import { TronWeb } from 'tronweb';

import { DevnetContractsExecutor } from '@molecula-monorepo/blockchain.addresses/deploy';

import { abi as executorABI } from '../../artifacts/contracts/executor/Executor.sol/Executor.json';
import { shastaConfig } from '../../configs/tron/shastaTyped';

/**
 * This script is for test/devnet use only.
 * It synchronizes the Custom Executor contract's per-destination config from the LZ Executor.
 */
async function syncExecutorParams() {
    // Initialize TronWeb instance for interacting with Tron network
    const tronWeb = new TronWeb({
        fullHost: shastaConfig.RPC_URL,
    });

    // Derive account from mnemonic phrase (read from env)
    const accountInfo = tronWeb.fromMnemonic(
        process.env.TRON_SEED_PHRASE as string,
        "m/44'/195'/0'/0/0",
    );
    if (accountInfo instanceof Error) {
        throw new Error('Invalid account information returned from fromMnemonic.');
    }

    // Strip "0x" if present and set as signing key for TronWeb
    const privateKey = accountInfo.privateKey.substring(2);
    tronWeb.setPrivateKey(privateKey);

    // Get the deployed Executor contract address for Tron (Shasta)
    const executorLzAddress = tronWeb.address.fromHex(shastaConfig.LAYER_ZERO_TRON_EXECUTOR);

    // Instantiate the LZ Executor contract object
    const executorLz = tronWeb.contract(executorABI, executorLzAddress);

    // @ts-ignore (TronWeb typings for contract calls are incomplete)
    const dstConfig = await executorLz.methods
        .dstConfig(shastaConfig.LAYER_ZERO_ETHEREUM_EID)
        .call();
    console.log('Current LZ destination config:', dstConfig);

    // Get the deployed Executor contract address for Tron (Shasta)
    const executorAddress = tronWeb.address.fromHex(DevnetContractsExecutor.tron.executor);

    // Instantiate the Executor contract object
    const executor = tronWeb.contract(executorABI, executorAddress);

    // Set the WorkerFeeLib contract address for the Executor (enables fee computation)
    // @ts-ignore (TronWeb typings for contract calls are incomplete)
    const tx = await executor.methods
        .setWorkerFeeLib(DevnetContractsExecutor.tron.executorFeeLib)
        .send();
    console.log('ExecutorFeeLib setup transaction:', tx);

    // Prepare and send destination configuration update.
    // The array corresponds to: [
    //   dstEid, lzReceiveBaseGas, lzComposeBaseGas, multiplierBps, floorMarginUSD, nativeCap
    // ]
    // All values must be passed as strings (TronWeb limitation).
    const dstConfigWithEid = [
        shastaConfig.LAYER_ZERO_ETHEREUM_EID, // dstEid
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

// Run the script and handle errors for standalone CLI use
syncExecutorParams()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
