import type { HardhatRuntimeEnvironment } from 'hardhat/types';

import type { ContractsExecutor, EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getEnvironmentConfig, readFromFile } from '../../../utils/deployUtils';

/**
 * This script is for test/devnet configuration only.
 * It synchronizes the Custom Executor contract's per-destination config from the LZ Executor.
 */
export async function syncExecutorParams(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
) {
    // Load the executor contracts' parameters from a JSON file for this environment
    const contractsExecutor: ContractsExecutor = await readFromFile(
        `${environment}/contracts_executor.json`,
    );

    // Retrieve environment-specific configuration
    const config = getEnvironmentConfig(environment);
    // Connect to the deployed LZ Executor contract using the devnet address
    const executorLZ = await hre.ethers.getContractAt('Executor', config.LAYER_ZERO_EXECUTOR);

    // Fetch the dstConfig struct from the LZ Executor for the Tron EID
    const lzDstConfig = await executorLZ.dstConfig(config.LAYER_ZERO_TRON_EID);

    // Prepare destination config array for LayerZero remote chain (e.g., Sepolia → Tron)
    // DstConfig fields:
    //   - dstEid: Remote endpoint ID
    //   - lzReceiveBaseGas: Gas allocated for receive calls
    //   - lzComposeBaseGas: Gas for compose calls (multi-hop)
    //   - multiplierBps: Fee multiplier in basis points (BPS)
    //   - floorMarginUSD: Minimum margin in USD (as uint256, in wei-like units)
    //   - nativeCap: Max allowed native token value
    const dstConfigs = [
        {
            dstEid: config.LAYER_ZERO_TRON_EID,
            lzReceiveBaseGas: lzDstConfig.lzReceiveBaseGas,
            multiplierBps: lzDstConfig.multiplierBps,
            floorMarginUSD: lzDstConfig.floorMarginUSD,
            nativeCap: lzDstConfig.nativeCap,
            lzComposeBaseGas: lzDstConfig.lzComposeBaseGas,
        },
    ];

    // Connect to the deployed Custom Executor contract using the devnet address
    const executor = await hre.ethers.getContractAt('Executor', contractsExecutor.eth.executor);

    // Set the WorkerFeeLib contract address (enables fee computation for cross-chain jobs)
    const setFeeLibTx = await executor.setWorkerFeeLib(contractsExecutor.eth.executorFeeLib);
    const receiptFeeLibSet = await setFeeLibTx.wait();
    console.log('setWorkerFeeLib transaction hash:', receiptFeeLibSet?.hash);

    // Set the destination config(s) on the Executor contract
    const setDstConfigTx = await executor.setDstConfig(dstConfigs);
    const receiptConfigSet = await setDstConfigTx.wait();
    console.log('setDstConfig transaction hash:', receiptConfigSet?.hash);
}
