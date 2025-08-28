import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { getConfig } from '../../../utils/deployUtils';

/**
 * Deploys the ExecutorFeeLib and Executor contracts for the specified environment.
 *
 * @param hre - Hardhat runtime environment (injected by Hardhat scripts).
 * @param environment - Project environment identifier (e.g., devnet, testnet, mainnet).
 * @returns An object containing the deployed contract addresses.
 */
export async function deployExecutor(hre: HardhatRuntimeEnvironment, environment: EnvironmentType) {
    // Get the environment-specific config and deployer account info.
    const { config, account } = await getConfig(hre, environment);

    // Prepare and deploy the ExecutorFeeLib contract.
    // Constructor args:
    //   - LAYER_ZERO_ETHEREUM_EID: local endpoint ID (used by the fee lib for quoting)
    //   - 1 ether: nativeDecimalsRate (scaling factor for native asset, e.g. 1e18 for ETH)
    const ExecutorFeeLib = await hre.ethers.getContractFactory('ExecutorFeeLib');
    const executorFeeLib = await ExecutorFeeLib.deploy(
        config.LAYER_ZERO_ETHEREUM_EID,
        hre.ethers.parseEther('1'),
    );
    // Wait for the ExecutorFeeLib contract to be fully deployed and mined.
    await executorFeeLib.waitForDeployment();
    // Get the deployed contract address.
    const executorFeeLibAddress = await executorFeeLib.getAddress();
    console.log('ExecutorFeeLib deployed: ', executorFeeLibAddress);

    // Prepare and deploy the main Executor contract.
    // Constructor args:
    //   - LAYER_ZERO_ENDPOINT: address of the LayerZero endpoint contract
    //   - LAYER_ZERO_RECEIVE_ULN_LIB: address of the receive ULN (DVN) library
    //   - [LAYER_ZERO_SEND_ULN_LIB]: array of message lib addresses (grant MESSAGE_LIB_ROLE)
    //   - LAYER_ZERO_PRICE_FEED: price feed contract address for fee quoting
    //   - account.address: role admin address (gets DEFAULT_ADMIN_ROLE)
    //   - [account.address]: admin addresses (gets ADMIN_ROLE)
    const Executor = await hre.ethers.getContractFactory('Executor');
    const executor = await Executor.deploy(
        config.LAYER_ZERO_ENDPOINT,
        config.LAYER_ZERO_RECEIVE_ULN_LIB,
        [config.LAYER_ZERO_SEND_ULN_LIB],
        config.LAYER_ZERO_PRICE_FEED,
        account.address,
        [account.address],
    );
    // Wait for the Executor contract to be fully deployed and mined.
    await executor.waitForDeployment();
    // Get the deployed contract address.
    const executorAddress = await executor.getAddress();
    console.log('Executor deployed: ', executorAddress);

    // Return the deployed addresses, structured for use in config maps.
    return {
        eth: {
            executorFeeLib: executorFeeLibAddress,
            executor: executorAddress,
        },
    };
}
