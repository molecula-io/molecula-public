import { type HardhatRuntimeEnvironment } from 'hardhat/types';

import type { EnvironmentType } from '@molecula-monorepo/blockchain.addresses';

import { DEPLOY_GAS_LIMIT } from '../../../configs/ethereum';
import { getConfig, getEthereumAddress } from '../../utils/deployUtils';

export async function deployCarbon(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    contracts: {
        supplyManagerAddress: string;
        moleculaPoolAddress: string;
    },
) {
    const { config, account } = await getConfig(hre, environment);

    // calc agent LZ future address
    const transactionCount = await account.getNonce();
    const agentLZFutureAddress = hre.ethers.getCreateAddress({
        from: account.address,
        nonce: transactionCount,
    });

    // deploy agentLZ
    const AgentLZ = await hre.ethers.getContractFactory('AgentLZ');
    const agentLZ = await AgentLZ.deploy(
        account.address,
        config.AGENT_AUTHORIZED_LZ_CONFIGURATOR,
        config.LAYER_ZERO_ENDPOINT,
        contracts.supplyManagerAddress,
        config.LAYER_ZERO_TRON_EID,
        config.USDT_ADDRESS,
        config.USDT_OFT,
        { gasLimit: DEPLOY_GAS_LIMIT },
    );
    await agentLZ.waitForDeployment();
    console.log('AgentLZ deployed: ', await agentLZ.getAddress());

    if ((await agentLZ.getAddress()) !== agentLZFutureAddress) {
        throw new Error(`AgentLZ address is not correct, future address: ${agentLZFutureAddress}`);
    }

    console.log('Agent deployed: ', await agentLZ.getAddress());
    console.log('Please setup SupplyManager to work with the deployed AgentLZ separately.');

    return {
        moleculaPool: contracts.moleculaPoolAddress,
        agentLZ: await agentLZ.getAddress(),
        supplyManager: contracts.supplyManagerAddress,
        poolKeeper: config.POOL_KEEPER,
    };
}

export async function setOAppPeer(
    hre: HardhatRuntimeEnvironment,
    environment: EnvironmentType,
    contracts: {
        agentLZ: string;
        accountantLZ: string;
    },
) {
    const { config } = await getConfig(hre, environment);

    const accountantLzHexaDecimal = getEthereumAddress(environment, contracts.accountantLZ);

    const agentLZContract = await hre.ethers.getContractAt('IOAppCore', contracts.agentLZ);

    const addressInBytes32 = hre.ethers.zeroPadValue(accountantLzHexaDecimal, 32);

    const response = await agentLZContract.setPeer(config.LAYER_ZERO_TRON_EID, addressInBytes32);

    await response.wait();

    console.log(`\tSet accountantLZ for contract AgentLZ ${contracts.agentLZ}.`);
}
